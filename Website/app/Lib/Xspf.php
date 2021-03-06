<?php

/*
 * MovieContentFilter (https://www.moviecontentfilter.com/)
 * Copyright (c) delight.im (https://www.delight.im/)
 * Licensed under the GNU AGPL v3 (https://www.gnu.org/licenses/agpl-3.0.txt)
 */

namespace App\Lib;

use App\Lib\Playlist\FilePlaylist;
use App\Lib\Playlist\PlaylistItem;

/** Description of content that may be filtered in a video or audio file using an XSPF playlist */
final class Xspf extends FilePlaylist {

	/**
	 * Converts this instance to a string representation
	 *
	 * @return string the string representation
	 */
	public function __toString() {
		$lines = [];

		$lines[] = '<?xml version="1.0" encoding="utf-8"?>';
		$lines[] = '<playlist version="1" xmlns="http://xspf.org/ns/0/" xmlns:vlc="http://www.videolan.org/vlc/playlist/ns/0/">';
		$lines[] = "\t".'<creator>MovieContentFilter</creator>';
		$lines[] = "\t".'<info>'.Xml::escape($this->publicInfoUrl).'</info>';
		$lines[] = "\t".'<trackList>';

		$counter = 0;

		foreach ($this->annotations as $annotation) {
			$lines[] = "\t\t".'<track>';

			if ($annotation instanceof PlaylistItem) {
				$lines[] = "\t\t\t".'<title>'.Xml::escape($annotation->getDetailsUrl()).'</title>';
			}
			else {
				$lines[] = "\t\t\t".'<title></title>';
			}

			// if the end of this annotation extends up to the very end of the file
			if ($annotation->getTiming()->getEnd()->equals($this->endTime)) {
				// let this annotation end at zero seconds to symbolize the very end of the file
				$endTimestamp = static::createTimestampFromSeconds(0);
			}
			// if this annotation ends somewhere in the middle of the file
			else {
				// do not modify this annotation
				$endTimestamp = $annotation->getTiming()->getEnd();
			}

			$lines[] = "\t\t\t".'<location>'.Xml::escape($this->mediaFileUri).'</location>';
			$lines[] = "\t\t\t".'<extension application="http://www.videolan.org/vlc/playlist/0">';
			$lines[] = "\t\t\t\t".'<vlc:id>'.$counter.'</vlc:id>';
			$lines[] = "\t\t\t\t".'<vlc:option>start-time='.((string) $annotation->getTiming()->getStart()).'</vlc:option>';
			$lines[] = "\t\t\t\t".'<vlc:option>stop-time='.((string) $endTimestamp).'</vlc:option>';

			if ($annotation instanceof FilterableAnnotation xor $this->inverted) {
				if ($annotation instanceof PlaylistItem) {
					if ($annotation->containsChannel('video') || $annotation->containsChannel('both')) {
						$lines[] = "\t\t\t\t".'<vlc:option>no-video</vlc:option>';
					}

					if ($annotation->containsChannel('audio') || $annotation->containsChannel('both')) {
						$lines[] = "\t\t\t\t".'<vlc:option>no-audio</vlc:option>';
					}
				}
				else {
					$lines[] = "\t\t\t\t".'<vlc:option>no-video</vlc:option>';
					$lines[] = "\t\t\t\t".'<vlc:option>no-audio</vlc:option>';
				}
			}

			$lines[] = "\t\t\t".'</extension>';
			$lines[] = "\t\t".'</track>';

			$counter++;
		}

		$lines[] = "\t".'</trackList>';
		$lines[] = '</playlist>';
		$lines[] = '';

		return implode("\n", $lines);
	}

}
