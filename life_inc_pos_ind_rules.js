/*
*	Life-Including-Positioned-Individual-Rules for Web - 2D cellular automaton where each cell has its own state transition rules defined by 9+9 randomly chosen cells
*	v0.2.0, 2021.10.24
*	Copyright (c) 2021 serhon <serhon@protonmail.com>
*/

// Consts
const lirNameVerStr = "Life-Including-Positioned-Individual-Rules v0.2.0 for Web";
const lirUrlStr = "https://github.com/serhon/lipir";

const lirControlsHelpStr = "<i>Controls</i><br><br>\
0: pause to edit<br>\
1&ndash;9: speed<br>\
M: max speed<br>\
N (speed=0): next instant<br>\
L-CLICK (speed=0): edit<br>\
CTRL: protect (freeze)<br>\
SHIFT: edit 5×5 instead of 1×1<br>\
I: invert<br>\
R: reset field to random<br>\
C: clear field<br>\
P: reset rules' positions to random";

const lirRainbowColors = [
	[0x00, 0x00, 0x00],  // black
	[0xD0, 0x00, 0xF0],  // violet
	[0x00, 0x00, 0xD0],  // blue
	[0x00, 0x60, 0xFF],  // light-blue
	[0x00, 0xD0, 0xD0],  // cyan (ILLIGAL ALIEN)
	[0x40, 0xC0, 0x00],  // green
	[0xF0, 0xF0, 0x00],  // yellow
	[0xF0, 0x80, 0x00],  // orange
	[0xF0, 0x00, 0x00]]; // red


// Primary adjustable parameters; can be changed with "LIPIR" object in HTML that embeds this script
var lirFieldSizeLog = ((typeof LIPIR !== "undefined") && (typeof LIPIR.fieldSizeLog === "number")) ? LIPIR.fieldSizeLog : 6;
var lirCellSize = ((typeof LIPIR !== "undefined") && (typeof LIPIR.cellSize === "number")) ? LIPIR.cellSize : 11;
var lirFramerate = ((typeof LIPIR !== "undefined") && (typeof LIPIR.framerate === "number")) ? LIPIR.framerate : 10;
var lirMaxFramerate = ((typeof LIPIR !== "undefined") && (typeof LIPIR.maxFramerate === "number")) ? LIPIR.maxFramerate : 120;
var lirShowGrid = ((typeof LIPIR !== "undefined") && (typeof LIPIR.showGrid === "boolean")) ? LIPIR.showGrid : true;
var lirShowAgecolors = ((typeof LIPIR !== "undefined") && (typeof LIPIR.showAgecolors === "boolean")) ? LIPIR.showAgecolors : false;

var lirEmptyRulesAreBirth = ((typeof LIPIR !== "undefined") && (typeof LIPIR.emptyRulesAreBirth === "boolean")) ? LIPIR.emptyRulesAreBirth : true;
var lirAliveRulesAreDeath = ((typeof LIPIR !== "undefined") && (typeof LIPIR.aliveRulesAreDeath === "boolean")) ? LIPIR.aliveRulesAreDeath : true;

var lirControlsWidth = ((typeof LIPIR !== "undefined") && (typeof LIPIR.controlsWidth === "number")) ? LIPIR.controlsWidth : 384;
var lirControlsLeftPadding = ((typeof LIPIR !== "undefined") && (typeof LIPIR.controlsLeftPadding === "number")) ? LIPIR.controlsLeftPadding : 48;

var lirControlsFontSize = ((typeof LIPIR !== "undefined") && (typeof LIPIR.controlsFontSize === "number")) ? LIPIR.controlsFontSize : 20;
var lirHelpFontSize = ((typeof LIPIR !== "undefined") && (typeof LIPIR.helpFontSize === "number")) ? LIPIR.helpFontSize : 18;
var lirCredFontSize = ((typeof LIPIR !== "undefined") && (typeof LIPIR.credFontSize === "number")) ? LIPIR.credFontSize : 12;


// Derived parameters
var lirFieldSize = 1 << lirFieldSizeLog;
var lirFieldSizeMask = lirFieldSize - 1;

var lirCanvasSize = lirCellSize * lirFieldSize;

// Well... palette
var lirPalette = new Array(0x100 + 3); // 0 - black, [1, 0xFF] - rainbow-log-scaled , 0x100 - white, 0x101 - grey, 0x102 - dark grey

// B/D rules' positions for each cell
var lirEmptyRulesPositions;
var lirAliveRulesPositions;

// Field data
var lirFieldCurrent;
var lirFieldNext;
var lirFieldProtect;

var lirPageLoaded = false;

// Sync timer id
var lirSyncTimerID;

var lirTimeSteps = 0;


// Canvas, controls & other markup
var lirHTML = "";

lirHTML += "<div style=\"float: left;\">";
lirHTML += "<canvas id=\"lir_canvas\" width=\"" + lirCanvasSize + "\" height=\"" + lirCanvasSize + "\" style=\"width: " + lirCanvasSize + "px; height: " + lirCanvasSize + "px; box-shadow: 0 0 8px #000000;\"></canvas>"; // there are "native" and "on-page" width & height of canvas... ensuring they're equal
lirHTML += "</div>";

lirHTML +=  "<div style=\"float: left; width: " + lirControlsWidth + "px; padding-left: " + lirControlsLeftPadding + "px;\">";

lirHTML += "<form style=\"font-size: " + lirControlsFontSize + "px;\">";

lirHTML += "<p>Speed: <input type=\"range\" id=\"lirSliderFramerate\" title=\"Generations per second (roughly)\n0 to pause and edit\" min=\"0\" max=\"" + lirMaxFramerate + "\" step=\"1\" value=\"" + lirFramerate + "\" style=\"width: 240px;\" onChange=\"lirFramerateChange()\" /> <label id=\"lirLabelFramerate\">" + lirFramerate + "</label><br>";

lirHTML += "<input type=\"checkbox\" id=\"lirCheckboxGrid\" checked onChange=\"lirGridChange()\" /> <label>Grid</label><br>";

lirHTML += "<input type=\"checkbox\" id=\"lirCheckboxAgecolors\" title=\"Newer (violet) to older (red), log-rainbow palette\" onChange=\"lirAgecolorsChange()\" /> <label>Agecolors</label></p>";

lirHTML += "<hr><p>Rules for Empty:<br>\
<label title=\"Alive cell at rule's position means Empty → Alive\"><input type=\"radio\" name=\"lirRadioEmptyRulesType\" id=\"lirRadioEmptyRulesAreBirth\" value=\"birth\" checked onChange=\"lirEmptyRulesTypeChange()\">Birth</label>\
&emsp;&emsp;&emsp;&emsp;\
<label title=\"Alive cell at rule's position means Empty → Empty\"><input type=\"radio\" name=\"lirRadioEmptyRulesType\" value=\"quiescence\" onChange=\"lirEmptyRulesTypeChange()\">Quiescence</label>\
</p>";

lirHTML += "<hr><p>Rules for Alive:<br>\
<label title=\"Alive cell at rule's position means Alive → Empty\"><input type=\"radio\" name=\"lirRadioAliveRulesType\" id=\"lirRadioAliveRulesAreDeath\" value=\"death\" checked onChange=\"lirAliveRulesTypeChange()\">Death</label>\
&emsp;&emsp;&emsp;&emsp;\
<label title=\"Alive cell at rule's position means Alive → Alive\"><input type=\"radio\" name=\"lirRadioAliveRulesType\" value=\"survival\" onChange=\"lirAliveRulesTypeChange()\">Survival</label>\
</p>";

lirHTML += "</form>";

lirHTML += "<hr><p style=\"font-size: " + lirHelpFontSize + "px; margin: 8px auto 0px auto;\">" + lirControlsHelpStr + "</p>";

lirHTML += "<hr><p style=\"font-size: " + lirCredFontSize + "px; margin: 8px auto 0px auto;\">" + lirNameVerStr + "<br><a href=\"" + lirUrlStr + "\">" + lirUrlStr + "</a></p>";

lirHTML += "</div>";

lirHTML +=  "<div style=\"clear: both; height: 0px;\">&nbsp;</div>";


document.write(lirHTML);

document.close();


var lirCanvas = document.getElementById("lir_canvas");
var lirCanvasContext = lirCanvas.getContext("2d");
var lirCanvasImageData = lirCanvasContext.getImageData(0, 0, lirCanvasSize, lirCanvasSize);
var lirCanvasRawData = lirCanvasImageData.data;

// Handlers for controls

// Framerate changed
function lirFramerateChange() {
	if (lirPageLoaded) {
		lirFramerate = lirSliderFramerate.value;
		lirLabelFramerate.innerHTML = lirFramerate;

		if (lirSyncTimerID >= 0) {
			window.clearInterval(lirSyncTimerID);
			lirSyncTimerID = -1;
		}

		if (lirFramerate > 0) {
			lirSyncTimerID = window.setInterval("lirSyncField()", 1000 / lirFramerate);
		}
	}
}

// ShowGrid changed
function lirGridChange() {
	if (lirPageLoaded) {
		lirShowGrid = lirCheckboxGrid.checked;
		lirDrawField();
	}
}

// ShowAgecolors changed
function lirAgecolorsChange() {
	if (lirPageLoaded) {
		lirShowAgecolors = lirCheckboxAgecolors.checked;
		lirDrawField();
	}
}

// EmptyRules type changed
function lirEmptyRulesTypeChange() {
	if (lirPageLoaded) {
		lirEmptyRulesAreBirth = lirRadioEmptyRulesAreBirth.checked;
	}
}

// AliveRules type changed
function lirAliveRulesTypeChange() {
	if (lirPageLoaded) {
		lirAliveRulesAreDeath = lirRadioAliveRulesAreDeath.checked;
	}
}

// Low-level math...

function lirHeaviside(value) { // Should be 1 for positive value, 0 for the rest
	return (value > 0) ? 1 : 0; // exercise: optimize it platform-independently to avoid execution branches... in the absence of Math.sign()
}

function lirIncBinLog(value, maxLog) { // 0 for 0, then incremented binary logarithm up to maxLog
	var res = 0;

	while ((value > 0) && (res < maxLog)) {
		value >>= 1;
		res++;
	}

	return res;
}

// Graphics...

function lirDrawPixel(x, y, colorIndex) {
	var paletteEntry = lirPalette[colorIndex];
	var red = paletteEntry[0];
	var green = paletteEntry[1];
	var blue = paletteEntry[2];

	var offset = (y * lirCanvasSize + x) << 2; // RGBA for each pixel

	lirCanvasRawData[offset+0] = red;
	lirCanvasRawData[offset+1] = green;
	lirCanvasRawData[offset+2] = blue;
	lirCanvasRawData[offset+3] = 0xFF;
}

function lirDrawRect(x, y, w, h, colorIndex) {
	for (var i = x; i < (x + w); i++) {
		lirDrawPixel(i, y, colorIndex);
		lirDrawPixel(i, y + h - 1, colorIndex);
	}
	for (var j = y; j < (y + h); j++) {
		lirDrawPixel(x, j, colorIndex);
		lirDrawPixel(x + w - 1, j, colorIndex);
	}
}

function lirDrawThickRect(x, y, w, h, colorIndex) {
	lirDrawRect(x, y, w, h, colorIndex);
	lirDrawRect(x + 1, y + 1, w - 2, h - 2, colorIndex);
}

function lirDrawGrid(colorIndex) {
	for (var i = 0; i < lirFieldSize; i++) {
		for (var z = 0; z < lirFieldSize * lirCellSize; z++) {
			lirDrawPixel(z, i * lirCellSize, 0x102);
			lirDrawPixel(i * lirCellSize, z, 0x102);
		}
	}
}

function lirDrawCross(x, y, s, colorIndex) {
	for (var i = 0; i < s; i++) {
		lirDrawPixel(x + i, y + i, colorIndex);
		lirDrawPixel(x + s - 1 - i, y + i, colorIndex);
	}
}

function lirFillRect(x, y, w, h, colorIndex) {
	var paletteEntry = lirPalette[colorIndex];
	var red = paletteEntry[0];
	var green = paletteEntry[1];
	var blue = paletteEntry[2];

	var offset = (y * lirCanvasSize + x) << 2; // RGBA for each pixel
	var nextRowOffsetDelta = (lirCanvasSize - w) << 2;

	for (var i = 0; i < h; i++) {
		for (var j = 0; j < w; j++) {
			lirCanvasRawData[offset++] = red;
			lirCanvasRawData[offset++] = green;
			lirCanvasRawData[offset++] = blue;
			lirCanvasRawData[offset++] = 0xFF;
		}

		offset += nextRowOffsetDelta;
	}

}

// Field-related functions...

function lirInitRulesPositions() {
	lirEmptyRulesPositions = new Array(lirFieldSize)
	lirAliveRulesPositions = new Array(lirFieldSize)

	for (var y = 0; y < lirFieldSize; y++) {
		lirEmptyRulesPositions[y] = new Array(lirFieldSize);
		lirAliveRulesPositions[y] = new Array(lirFieldSize);
		for (var x = 0; x < lirFieldSize; x++) {
			lirEmptyRulesPositions[y][x] = new Array(9);
			lirAliveRulesPositions[y][x] = new Array(9);		
			for (var i = 0; i < 9; i++) {
				lirEmptyRulesPositions[y][x][i] = new Array(2);
				lirAliveRulesPositions[y][x][i] = new Array(2);
			}
		}
	}
}

function lirResetRulesPositions() {
	for (var y = 0; y < lirFieldSize; y++) {
		for (var x = 0; x < lirFieldSize; x++) {
			for (var i = 0; i < 9; i++) {
				lirEmptyRulesPositions[y][x][i] = [Math.floor(Math.random() * lirFieldSize), Math.floor(Math.random() * lirFieldSize)];
				lirAliveRulesPositions[y][x][i] = [Math.floor(Math.random() * lirFieldSize), Math.floor(Math.random() * lirFieldSize)];
			}
		}
	}
}

function lirInitField() {
	lirFieldCurrent = new Array(lirFieldSize);
	lirFieldNext = new Array(lirFieldSize);
	lirFieldProtect = new Array(lirFieldSize);

	for (var y = 0; y < lirFieldSize; y++) {
		lirFieldCurrent[y] = new Array(lirFieldSize);
		lirFieldNext[y] = new Array(lirFieldSize);

		lirFieldProtect[y] = new Array(lirFieldSize);
		for (var x = 0; x < lirFieldSize; x++) {
			lirFieldProtect[y][x] = false;
		}
	}
}

function lirFillCellRect(x, y, w, h, v) {
	for (var i = y; i < (y + h); i++) {
		for (var j = x; j < (x + w); j++) {
			lirFieldCurrent[i][j] = v;
		}
	}
}

function lirFillCellProtectRect(x, y, w, h, v) {
	for (var j = y; j < (y + h); j++) {
		for (var i = x; i < (x + w); i++) {
			lirFieldProtect[j][i] = v;
		}
	}
}

function lirClearField() {
	lirFillCellRect(0, 0, lirFieldSize, lirFieldSize, 0);
	lirFillCellProtectRect(0, 0, lirFieldSize, lirFieldSize, false);
}

function lirFillRandomField() {
	for (var y = 0; y < lirFieldSize; y++) {
		for (var x = 0; x < lirFieldSize; x++) {
			lirFieldCurrent[y][x] = Math.floor(Math.random() * 2);
		}
	}
	lirFillCellProtectRect(0, 0, lirFieldSize, lirFieldSize, false);
}

function lirCheckCell(x, y) {
	return (lirFieldCurrent[y][x] > 0);
}

function lirNegateCellRect(x, y, w, h) {
	for (var i = y; i < (y + h); i++) {
		for (var j = x; j < (x + w); j++) {
			if (!lirFieldProtect[i][j]) {
				lirFieldCurrent[i][j] = (lirFieldCurrent[i][j] > 0) ? 0 : 1;
			}
		}
	}
}

function lirResetField(clear) {
	if (clear) {
		lirClearField();
	} else {
		lirFillRandomField();
	}

	lirTimeSteps = 0;
}

function lirFlipCurrentNext() { // swapping pointers instead of copying...
	var storedPointer = lirFieldCurrent;

	lirFieldCurrent = lirFieldNext;
	lirFieldNext = storedPointer;
}

function lirCountAliveNeighbours(y, x) {
	var an = 0;

	an += lirHeaviside(lirFieldCurrent[y][(x + 1) & lirFieldSizeMask]);
	an += lirHeaviside(lirFieldCurrent[(y + 1) & lirFieldSizeMask][(x + 1) & lirFieldSizeMask]);
	an += lirHeaviside(lirFieldCurrent[(y + 1) & lirFieldSizeMask][x]);
	an += lirHeaviside(lirFieldCurrent[(y + 1) & lirFieldSizeMask][(x - 1) & lirFieldSizeMask]);
	an += lirHeaviside(lirFieldCurrent[y][(x - 1) & lirFieldSizeMask]);
	an += lirHeaviside(lirFieldCurrent[(y - 1) & lirFieldSizeMask][(x - 1) & lirFieldSizeMask]);
	an += lirHeaviside(lirFieldCurrent[(y - 1) & lirFieldSizeMask][x]);
	an += lirHeaviside(lirFieldCurrent[(y - 1) & lirFieldSizeMask][(x + 1) & lirFieldSizeMask]);

	return an;
}

function lirUpdateField() { // main one...
	for (var y = 0; y < lirFieldSize; y++) {
		for (var x = 0; x < lirFieldSize; x++) {

			var cellAge = lirFieldCurrent[y][x];
			var cellAlive = lirHeaviside(cellAge);

			var cellAliveNeighbours = lirCountAliveNeighbours(y, x);

			var cellNextState = cellAlive;

			if (!lirFieldProtect[y][x]) {
				if (cellAlive == 0) {
					var rule_pos = lirEmptyRulesPositions[y][x][cellAliveNeighbours];
					rule_state = (lirFieldCurrent[rule_pos[0]][rule_pos[1]] > 0);
					if ((lirEmptyRulesAreBirth && rule_state) || (!lirEmptyRulesAreBirth && !rule_state)) {
						cellNextState = 1;
					}
				} else {
					var rule_pos = lirAliveRulesPositions[y][x][cellAliveNeighbours];
					rule_state = (lirFieldCurrent[rule_pos[0]][rule_pos[1]] > 0);
					if ((lirAliveRulesAreDeath && rule_state) || (!lirAliveRulesAreDeath && !rule_state)) {
						cellNextState = 0;
					}
				}
			}

			var deltaAge = cellNextState + (1 - cellNextState) * (-cellAge * cellAlive);
// if cellNextState = 1, it's 1 regardless of current state (age increments);
// otherwise, it's 0 for empty cell and (-cellAge) for alive one
// (so that cellAge + (-cellAge) = 0 => cell becomes empty)

			lirFieldNext[y][x] = cellAge + deltaAge;
		}
	}

	lirFlipCurrentNext();

	lirTimeSteps++;
}


function lirDrawField() {
	var nAlive = 0;

	for (var y = 0; y < lirFieldSize; y++) {
		for (var x = 0 ; x < lirFieldSize; x++) {
			cellAge = lirFieldCurrent[y][x];
			nAlive += (cellAge > 0) ? 1 : 0;
			var colorIndex = Math.min(0xFF, cellAge);
			if (!lirShowAgecolors) {
				colorIndex = (colorIndex > 0) ? 0x100 : 0;
			}

			lirFillRect(x * lirCellSize, y * lirCellSize, lirCellSize, lirCellSize, colorIndex);

			// Draw cross if cell is protected
			if (lirFieldProtect[y][x]) {
				lirDrawCross(x * lirCellSize, y * lirCellSize, lirCellSize, 0x101);
			}
		}
	}

	if (lirShowGrid) {
		lirDrawGrid();
	}

	lirCanvasContext.putImageData(lirCanvasImageData, 0, 0);

	lirCanvas.title = "Time: " + lirTimeSteps + "\nAlive: " + nAlive + ", Empty: " + (lirFieldSize * lirFieldSize - nAlive);
}


function lirSyncField() {
	lirUpdateField();
	lirDrawField();
}


// Generating palette...
function lirMakePalette() {
	lirPalette[0] = lirRainbowColors[0];

	for (var i = 1; i < 0x100; i++) {
		lirPalette[i] = lirRainbowColors[lirIncBinLog(i, 8)];
	}

	lirPalette[0x100] = [0xFF, 0xFF, 0xFF]; // white
	lirPalette[0x101] = [0x80, 0x80, 0x80]; // grey
	lirPalette[0x102] = [0x40, 0x40, 0x40]; // dark grey
}


// Initialization...
window.addEventListener("load", function() {
	lirPageLoaded = true;

	lirInitRulesPositions();
	lirInitField();

	lirResetRulesPositions();
	lirResetField(false);

	lirMakePalette();

	lirSyncTimerID = window.setInterval("lirSyncField()", 1000 / lirFramerate);
}, false);

// Input

// Edit field by click on it...
lirCanvas.addEventListener("click", function(event) {
	if (lirPageLoaded) {

		if (lirFramerate == 0) {
			var fX = Math.floor(event.offsetX / lirCellSize);
			var fY = Math.floor(event.offsetY / lirCellSize);

			d = event.shiftKey ? 2 : 0;

			for (var y = fY - d; y <= (fY + d); y++) {
				for (var x = fX - d; x <= (fX + d); x++) {
					if ((x >= 0) && (x < lirFieldSize) && (y >= 0) && (y < lirFieldSize)) {
						if (event.ctrlKey) {
							lirFieldProtect[y][x] = !lirFieldProtect[y][x];
						} else if (!lirFieldProtect[y][x]) {
							lirFieldCurrent[y][x] = 1 - lirHeaviside(lirFieldCurrent[y][x]); // empty becomes alive, and vice versa
						}							
					}
				}
			}

		}

		lirDrawField();
	}
}, false);

document.addEventListener("keypress", function(event) {
	if (lirPageLoaded) {
		// console.log(event.keyCode);
		if ((event.keyCode >= 48) && (event.keyCode <= 57)) { // 0 to 9 framerate
			lirSliderFramerate.value = Math.floor((event.keyCode - 48) * lirMaxFramerate / 10);
			lirFramerateChange();
		} else if (event.keyCode == 109) { // (M)ax framerate
			lirSliderFramerate.value = lirMaxFramerate;
			lirFramerateChange();
		} else if (event.keyCode == 110) { // (N)ext
			if (lirFramerate == 0) {
				lirUpdateField();
				lirDrawField();
			}
		} else if (event.keyCode == 105) { // (I)nvert
			lirNegateCellRect(0, 0, lirFieldSize, lirFieldSize);
			lirDrawField();
		} else if (event.keyCode == 114) { // (R)eset
			lirResetField(false);
			lirDrawField();
		} else if (event.keyCode == 99) { // (C)lear
			lirResetField(true);
			lirDrawField();
		} else if (event.keyCode == 112) { // Reset rules' (P)ositions
			lirResetRulesPositions();
		}
	}
}, false);
