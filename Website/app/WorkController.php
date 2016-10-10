<?php

/*
 * MovieContentFilter (http://www.moviecontentfilter.com/)
 * Copyright (c) delight.im (https://www.delight.im/)
 * Licensed under the GNU AGPL v3 (https://www.gnu.org/licenses/agpl-3.0.txt)
 */

namespace App;

use App\Lib\Imdb;
use Delight\Db\Throwable\IntegrityConstraintViolationException;
use Delight\Foundation\App;

class WorkController extends Controller {

	const YEAR_MIN = 1900;
	const YEAR_MAX = 2099;

	public static function showWork(App $app, $id) {
		$id = $app->ids()->decode(trim($id));

		$work = $app->db()->selectRow(
			'SELECT type, title, year, imdb_url FROM works WHERE id = ?',
			[ $id ]
		);

		$params = [
			'id' => $id,
			'type' => $work['type'],
			'title' => $work['title'],
			'year' => $work['year'],
			'imdbUrl' => $work['imdb_url']
		];

		if ($work['type'] === 'movie' || $work['type'] === 'episode') {
			if ($work['type'] === 'episode') {
				$params['series'] = $app->db()->selectRow(
					'SELECT b.id AS parent_id, b.title AS parent_title, a.season, a.episode_in_season FROM works_relations AS a JOIN works AS b ON a.parent_work_id = b.id WHERE a.child_work_id = ? LIMIT 0, 1',
					[ $id ]
				);
			}

			echo $app->view('view_single.html', $params);
		}
		else {
			$params['episodes'] = $app->db()->select(
				'SELECT b.id, a.season, a.episode_in_season, b.title, b.year FROM works_relations AS a JOIN works AS b ON a.child_work_id = b.id WHERE a.parent_work_id = ? ORDER BY a.season ASC, a.episode_in_season ASC LIMIT 0, 100',
				[ $id ]
			);

			echo $app->view('view_multiple.html', $params);
		}
	}

	public static function prepareWork(App $app) {
		self::ensureAuthenticated($app);

		$primaryType = $app->input()->get('primary-type');

		if ($primaryType === null) {
			echo $app->view('works_add_step_1.html');
		}
		else {
			if ($primaryType === 'movie' || $primaryType === 'series') {
				$params = [
					'primaryType' => $primaryType
				];

				if ($primaryType === 'series') {
					$params['seriesParents'] = $app->db()->select(
						'SELECT id, year, title FROM works WHERE type = ? ORDER BY year ASC, title ASC LIMIT 0, 1000',
						[ 'series' ]
					);

					// add an optional suggestion on which parent should be selected by default
					$params['seriesParentDefault'] = $app->ids()->decode(trim($_GET['parent-work-id']));
				}

				echo $app->view('works_add_step_2.html', $params);
			}
			else {
				self::failNotFound($app);
			}
		}
	}

	public static function saveWork(App $app) {
		self::ensureAuthenticated($app);

		$primaryType = $app->input()->post('primary-type');

		if ($primaryType === 'movie' || $primaryType === 'series') {
			$secondaryType = $app->input()->post('secondary-type');
			$title = $app->input()->post('title');
			$year = $app->input()->post('year', TYPE_INT);
			$imdbUrl = $app->input()->post('imdb-url');

			if (!empty($year) && !empty($imdbUrl)) {
				if ($year >= self::YEAR_MIN && $year <= self::YEAR_MAX) {
					if (s($imdbUrl)->matches(Imdb::WORK_URL_REGEX, $imdbUrlParts)) {
						if (!empty($title) || $secondaryType === 'episode') {
							try {
								$app->db()->insert(
									'works',
									[
										'type' => empty($secondaryType) ? $primaryType : $secondaryType,
										'title' => $title,
										'year' => $year,
										'imdb_url' => $imdbUrlParts[1],
										'author_user_id' => $app->auth()->id()
									]
								);
							}
							catch (IntegrityConstraintViolationException $e) {
								$app->flash()->warning('It seems there is already an entry for that movie or TV show. Please check again!');
								$app->redirect('/add?primary-type='.urlencode($primaryType));
								exit;
							}
						}
						else {
							$app->flash()->warning('The data you entered was invalid. Please try again!');
							$app->redirect('/add?primary-type='.urlencode($primaryType));
							exit;
						}

						$newWorkId = (int) $app->db()->getLastInsertId();

						if ($primaryType === 'series' && $secondaryType === 'episode') {
							$parent = $app->ids()->decode(trim($_POST['parent']));
							$season = $app->input()->post('season', TYPE_INT);
							$episode = $app->input()->post('episode', TYPE_INT);

							$app->db()->insert(
								'works_relations',
								[
									'parent_work_id' => $parent,
									'season' => $season,
									'episode_in_season' => $episode,
									'child_work_id' => $newWorkId
								]
							);
						}

						$app->flash()->success('The new entry has been successfully created. Thank you!');
						$app->redirect('/view/' . $app->ids()->encode($newWorkId));
					}
				}
			}
		}

		$app->flash()->warning('The data you entered was invalid. Please try again!');
		$app->redirect('/add');
	}

}
