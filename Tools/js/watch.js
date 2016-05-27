/*
 * Copyright (c) delight.im <info@delight.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

var McfSession = {};
McfSession.STORAGE_KEY_PREFERENCES = "preferences";
McfSession.STORAGE_KEY_LAST_SAVED = "last_saved_timestamp_ms";
McfSession.storage = new AbstractStorage();

function convertFilters(outputFormat) {
	var sourceText = $("#sourceText").val();
	var fileStartTime = $("#fileStartTime").val();
	var fileEndTime = $("#fileEndTime").val();
	var videoLocation = $("#videoLocation").val();
	var childCategory;

	var mcf;

	try {
		mcf = MovieContentFilter.parse(sourceText);
	}
	catch (e) {
		if (e instanceof MovieContentFilter.InvalidSourceTextException) {
			alert("Please paste some valid '.mcf' source text in the 'Load general filter' section");
		}
		else if (e instanceof MovieContentFilter.InvalidSourceStartTime) {
			alert("Your '.mcf' source text has an invalid overall start time");
		}
		else if (e instanceof MovieContentFilter.InvalidSourceEndTime) {
			alert("Your '.mcf' source text has an invalid overall end time");
		}
		else if (e instanceof MovieContentFilter.InvalidCueTimings) {
			alert("Your '.mcf' source text contains invalid cue timings ('"+e.start+"' and '"+e.end+"')");
		}
		else {
			alert("Unexpected error while parsing the source");
		}

		return;
	}

	// for every top-level category
	for (var topLevelCategory in MovieContentFilter.Schema.categories) {
		if (MovieContentFilter.Schema.categories.hasOwnProperty(topLevelCategory)) {
			// get and apply the preference
			mcf.setPreference(topLevelCategory, $("#"+createCategoryKey(topLevelCategory, null)).val());

			// for every subcategory
			for (var i = 0; i < MovieContentFilter.Schema.categories[topLevelCategory].length; i++) {
				childCategory = MovieContentFilter.Schema.categories[topLevelCategory][i];

				// get and apply the preference
				mcf.setPreference(childCategory, $("#"+createCategoryKey(childCategory, topLevelCategory)).val());
			}
		}
	}

	// save the preferences to the persistent storage
	McfSession.storage.setString(McfSession.STORAGE_KEY_PREFERENCES, mcf.getPreferencesJson());

	// remember when the preferences have been saved the last time
	McfSession.storage.setObject(McfSession.STORAGE_KEY_LAST_SAVED, Date.now());

	mcf.setVideoLocation(videoLocation);

	if (videoLocation === "") {
		alert("Please set the location of your video source in the 'Synchronization' section");
		return;
	}

	var retrieveOutputFunc;
	var outputFileName;
	var outputFileExtension;
	var outputMimeType;

	if (outputFormat === "xspf") {
		retrieveOutputFunc = mcf.toXspf;
		outputFileName = "Filter (XSPF)";
		outputFileExtension = ".xspf";
		outputMimeType = "application/xspf+xml";
	}
	else if (outputFormat === "m3u") {
		retrieveOutputFunc = mcf.toM3u;
		outputFileName = "Filter (M3U)";
		outputFileExtension = ".m3u";
		outputMimeType = "audio/x-mpegurl";
	}
	else if (outputFormat === "edl") {
		retrieveOutputFunc = mcf.toEdl;
		outputFileName = "Filter (EDL)";
		outputFileExtension = ".edl";
		outputMimeType = "text/plain";
	}
	else {
		throw "Unknown output format: "+outputFormat;
	}

	var outputText;
	try {
		outputText = retrieveOutputFunc.call(mcf, fileStartTime, fileEndTime);
	}
	catch (e) {
		if (e instanceof MovieContentFilter.InvalidTargetStartTime) {
			alert("Please enter a valid overall start time in the 'Synchronization' section");
		}
		else if (e instanceof MovieContentFilter.InvalidTargetEndTime) {
			alert("Please enter a valid overall end time in the 'Synchronization' section");
		}
		else {
			alert("Unexpected error during export");
		}

		return;
	}

	if (outputText === "") {
		alert("It seems your media file does not contain anything that should be filtered based on your selected preferences.\n\nThat means the content already meets your preferences and can probably be viewed as-is.\n\nYou may adjust your criteria in order to increase or reduce the set of included filters.");
		return;
	}

	try {
		var filename = outputFileName + outputFileExtension;
		saveTextToFile(outputText, filename, outputMimeType);
	}
	catch (e) {
		alert(e);
	}
}

function createCategoryKey(category, parentCategory) {
	if (parentCategory === null) {
		return "preference-"+category;
	}
	else {
		return "preference-"+parentCategory+"-"+category;
	}
}

function createCategoryLabel(category, parentCategory) {
	if (parentCategory === null) {
		return "<strong>"+capitalizeFirstLetter(category)+"</strong>";
	}
	else {
		return "<strong>"+capitalizeFirstLetter(parentCategory)+"</strong> &gt; "+capitalizeFirstLetter(category);
	}
}

function createPreferenceForCategory(category, parentCategory, initialPreferences) {
	var htmlBuffer = [];
	var optionsBuffer = [];
	var severitiesIncluded = [];
	var severity;
	var key = createCategoryKey(category, parentCategory);
	var label = createCategoryLabel(category, parentCategory);

	// first assume that filters are not enabled
	var enabled = false;

	// for every severity level
	for (var i = MovieContentFilter.Schema.severities.length - 1; i >= 0; i--) {
		severity = MovieContentFilter.Schema.severities[i];
		severitiesIncluded.unshift(severity);
		optionsBuffer.push("<option value=\""+severity+"\"");

		// if the current option is to be selected by default
		if (initialPreferences[category] && initialPreferences[category] === severity) {
			// apply the selection
			optionsBuffer.push(" selected=\"selected\"");

			// remember that the current filter is enabled
			enabled = true;
		}

		optionsBuffer.push(">Filter "+severitiesIncluded.join("/")+" severity</option>");
	}

	// add the first part of the select box to the HTML buffer
	htmlBuffer.push("<p><label for=\""+key+"\">"+label+"</label><select id=\""+key+"\" name=\""+key+"\" size=\"1\"");

	// if the filter is enabled
	if (enabled) {
		// do not append a class name
		htmlBuffer.push(" class=\"\"");
	}
	// if the filter is not enabled
	else {
		// append a class name symbolizing the state
		htmlBuffer.push(" class=\"mcf-disabled\"");
	}

	// add the next part of the select box to the HTML buffer
	htmlBuffer.push("><option value=\"\"> -- Do not filter anything --</option>");

	// append all options to the HTML buffer
	htmlBuffer = htmlBuffer.concat(optionsBuffer);

	// add the last part of the select box to the HTML buffer
	htmlBuffer.push("</select></p>");

	return htmlBuffer.join("");
}

function initPreferencesForm(initialPreferences, lastTimeSaved) {
	var target = $("#preferences");
	var htmlBuffer = [];
	var categoryHtml;
	var childCategory;

	// if the preferences had previously been saved already
	if (typeof lastTimeSaved === "number") {
		var lastTimeSavedObj = new Date(lastTimeSaved);

		htmlBuffer.push("<div id=\"preferences-collapsed\"><p class=\"intro\">If you want to keep all criteria unchanged, you do not need to review all the preferences again.</p><p>Your selections should have been saved so that you do not have to enter them again. The last time your preferences have been saved was: ");
		htmlBuffer.push(lastTimeSavedObj.toLocaleString());
		htmlBuffer.push("</p><button type=\"button\" onclick=\"$('#preferences-collapsed').hide(); $('#preferences-expanded').show();\">Show preferences</button></div>");
		htmlBuffer.push("<div id=\"preferences-expanded\" style=\"display:none;\">");
	}
	// if the preferences had never been saved previously
	else {
		htmlBuffer.push("<div id=\"preferences-expanded\">");
	}

	htmlBuffer.push("<p class=\"intro\">Please choose your <i>personal</i> criteria for content filtering below. Those will let you adjust precisely what types of content to block and what types of content to accept. Please take some time to check all criteria thoroughly.</p>");

	// for every top-level category
	for (var topLevelCategory in MovieContentFilter.Schema.categories) {
		if (MovieContentFilter.Schema.categories.hasOwnProperty(topLevelCategory)) {
			htmlBuffer.push("<p><button type=\"button\" class=\"small\">Change preferences for '");
			htmlBuffer.push(capitalizeFirstLetter(topLevelCategory));
			htmlBuffer.push("'</button></p>");
			htmlBuffer.push("<div style=\"display:none;\">");
			categoryHtml = createPreferenceForCategory(topLevelCategory, null, initialPreferences);
			htmlBuffer.push(categoryHtml);

			// for every subcategory
			for (var i = 0; i < MovieContentFilter.Schema.categories[topLevelCategory].length; i++) {
				childCategory = MovieContentFilter.Schema.categories[topLevelCategory][i];
				categoryHtml = createPreferenceForCategory(childCategory, topLevelCategory, initialPreferences);
				htmlBuffer.push(categoryHtml);
			}

			htmlBuffer.push("</div>");
		}
	}

	htmlBuffer.push("</div>");

	target.append(htmlBuffer.join(""));

	// whenever a top-level category button is pressed
	$("#preferences-expanded").on("click", "button", function () {
		var button = $(this);

		// hide the pressed button
		button.css("display", "none");

		// show the previously hidden contents for the selected category
		button.parent().next().css("display", "");
	});

	// whenever the value for a preference changes
	target.on("change", "select", function () {
		var self = $(this);

		// if the filter is now enabled
		if (this.value) {
			// remove the class name symbolizing the disabled state
			self.removeClass("mcf-disabled");
		}
		// if the filter is not enabled anymore
		else {
			// add the class name symbolizing the disabled state
			self.addClass("mcf-disabled");
		}
	});
}

function initExamplesForm() {
	var target = $("#sourceType");
	var htmlBuffer = [];

	// create the empty default option
	htmlBuffer.push("<option value=\"\">Any movie or TV show that I have an \".mcf\" file for</option>");

	var entry;
	var lastParent = null;

	// for every exemplary movie or TV show
	for (var i = 0; i < MovieContentFilter.Examples.length; i++) {
		entry = MovieContentFilter.Examples[i];

		// if the current entry belongs to a new parent
		if (entry.parent !== lastParent) {
			// if there has been another entry previously
			if (lastParent !== null) {
				// close the previous options group
				htmlBuffer.push("</optgroup>");
			}

			// open the next options group
			htmlBuffer.push("<optgroup label=\"");
			htmlBuffer.push(entry.parent);
			htmlBuffer.push("\">");

			// remember the new parent
			lastParent = entry.parent;
		}

		// add the current entry as an option
		htmlBuffer.push("<option value=\"");
		htmlBuffer.push(entry.path);
		htmlBuffer.push("\">");
		htmlBuffer.push(entry.parent);
		htmlBuffer.push(" - ");
		htmlBuffer.push(entry.name);
		htmlBuffer.push("</option>");
	}

	// if there were entries available
	if (lastParent !== null) {
		// close the last options group
		htmlBuffer.push("</optgroup>");
	}

	// update the select field with the built HTML content
	target.html(htmlBuffer.join(""));

	// listen for changes on the select field
	target.change(function () {
		var pasteArea = $("#sourceText");

		if (this.value === "") {
			// clear the paste area
			pasteArea.val("");

			// make the paste area editable
			pasteArea.prop("readonly", false);
		}
		else {
			// prevent the paste area from being edited
			pasteArea.prop("readonly", true);

			$.ajax({
				url: this.value,
				method: "GET",
				mimeType: "text/plain; charset=utf-8",
				dataType: "text",
				cache: false,
				success: function (data) {
					// insert the loaded filter into the paste area
					pasteArea.val(data);
					// trigger the `input` event on the paste area
					pasteArea.trigger("input");
				},
				error: function () {
					// if the document had been served on a file URL
					if (window.location.protocol === "file:") {
						// explain to the user why AJAX requests do not work on file URLs
						alert("Loading existing filters does not work when running this tool on your local machine without any web server.\n\nYou may change your web browser's security policy for file URLs, but you usually should not do that.");
					}
					// if the document had been served by a web server
					else {
						// tell the user that the request failed
						alert("The requested filter could not be loaded. Please check your internet connection.");
					}
				}
			});
		}
	});
}

function capitalizeFirstLetter(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

$(document).ready(function () {
	initExamplesForm();

	var initialPreferences = McfSession.storage.getObject(McfSession.STORAGE_KEY_PREFERENCES, {});
	var lastTimeSaved = McfSession.storage.getObject(McfSession.STORAGE_KEY_LAST_SAVED, null);
	initPreferencesForm(initialPreferences, lastTimeSaved);

	var fileStartTimeElement = $("#fileStartTime");
	var fileEndTimeElement = $("#fileEndTime");
	var container;

	$("#sourceText").on("input", function (e) {
		try {
			container = MovieContentFilter.parseContainer(e.target.value);
		}
		catch (e) {
			return;
		}

		if (container === null) {
			return;
		}

		fileStartTimeElement.val(container[2]);
		fileEndTimeElement.val(container[3]);
	});

	$(".mcf-convert-to-xspf").click(function () {
		convertFilters("xspf");
	});

	$(".mcf-convert-to-m3u").click(function () {
		convertFilters("m3u");
	});

	$(".mcf-convert-to-edl").click(function () {
		convertFilters("edl");
	});
});