const FCODE_G1 = 0x80;
const FCODE_G1_F = 0x40;
const FCODE_G1_X = 0x20;
const FCODE_G1_Y = 0x10;
const FCODE_G1_Z = 0x08;
const FCODE_G1_E0 = 0x04;
const FCODE_G1_E1 = 0x02;
const FCODE_G1_E2 = 0x01;
const FCODE_G92 = 0x40;
const FCODE_G92_X = 0x20;
const FCODE_G92_Y = 0x10;
const FCODE_G92_Z = 0x08;
const FCODE_G92_E0 = 0x04;
const FCODE_G92_E1 = 0x02;
const FCODE_G92_E2 = 0x01;
const FCODE_PWM_CTRL_SWAPPING = 0x30;
const FCODE_LASER_CTRL = 0x20;
const FCODE_HEATER_CTRL = 0x10;
const FCODE_PAUSE_WITH_HEIGHT = 0x07;
const FCODE_PAUSE_FOR_ROTARY = 0x06;
const FCODE_ENABLE_BOOST = 0x05;
const FCODE_SLEEP_G4 = 0x04;
const FCODE_G91_REL_POS = 0x03;
const FCODE_G90_ABS_POS = 0x02;
const FCODE_G28_HOME = 0x01;

function parseFcFile(arr, fname)
{
	var header = arr.slice(0, 8);
	var headerStr = String.fromCharCode.apply(null, new Uint8Array(header));
	console.log("header: " + headerStr);
	if (headerStr.startsWith("FCx") == false || headerStr.endsWith("\n") == false) {
		var err = "ERROR: FC file did not start with correct header. Expected \"FCx0001\". Got \"" + headerStr + "\"";
		console.log(err);
		return {
			header: headerStr,
			stream: [],
			stream_crc32: 0,
			metadata_raw: [],
			metadata_split: [],
			metadata_crc32: 0,
			commented_gcode: err,
			png_data: [],
			png_src: "",
		};
	}

	var stream_len_arr = new Uint8Array(arr.slice(8, 8 + 4));
	var stream_len = arr2u32(stream_len_arr);
	var metadata_idx = 8 + 4 + stream_len + 4;
	var stream_content = new Uint8Array(arr.slice(8 + 4, metadata_idx - 4));
	var stream_crc_arr = new Uint8Array(arr.slice(metadata_idx - 4, metadata_idx));
	var stream_crc32 = arr2u32(stream_crc_arr);
	var stream_crc32_calced = crc32(stream_content, 0);
	console.log("stream len: " + stream_len + " , crc: " + formatHex(stream_crc32, 8, "") + " ? " + formatHex(stream_crc32_calced, 8, ""));

	console.log("metadata idx: " + metadata_idx);
	var metadata_len_arr = new Uint8Array(arr.slice(metadata_idx, metadata_idx + 4));
	var metadata_len = arr2u32(metadata_len_arr);
	var metadata_content_arr = new Uint8Array(arr.slice(metadata_idx + 4, metadata_idx + 4 + metadata_len));
	var metadata_crc_arr = new Uint8Array(arr.slice(metadata_idx + 4 + metadata_len, metadata_idx + 4 + metadata_len + 4));
	var metadata_crc32 = arr2u32(metadata_crc_arr);
	var metadata_crc32_calced = crc32(metadata_content_arr, 0);
	console.log("metadata len: " + metadata_len + " , crc: " + formatHex(metadata_crc32, 8, "") + " ? " + formatHex(metadata_crc32_calced, 8, ""));

	var metadata_string = String.fromCharCode.apply(null, new Uint8Array(metadata_content_arr));
	console.log("metadata string: " + metadata_string);
	var metadata_split = metadata_string.split("\0");
	var commented_gcode = "; METADATA:\r\n";
	commented_gcode += "; FILENAME=" + fname + "\r\n";
	commented_gcode += "; STREAM_CRC=" + formatHex(stream_crc32, 8, "");
	if (stream_crc32_calced != stream_crc32) {
		commented_gcode += " =/= " + formatHex(stream_crc32_calced, 8, "");
	}
	commented_gcode += "\r\n";
	commented_gcode += "; METADATA_CRC=" + formatHex(metadata_crc32, 8, "");
	if (metadata_crc32_calced != metadata_crc32) {
		commented_gcode += " =/= " + formatHex(metadata_crc32_calced, 8, "");
	}
	commented_gcode += "\r\n";
	for (i = 0; i < metadata_split.length; i++) {
		if (metadata_split[i].length > 0) {
			commented_gcode += "; " + metadata_split[i] + "\r\n";
		}
	}
	commented_gcode += "\r\n";

	var png_src = "";
	var png_idx = metadata_idx + 4 + metadata_len + 4 + 4;
	var png_len_arr = new Uint8Array(arr.slice(metadata_idx + 4 + metadata_len + 4, metadata_idx + 4 + metadata_len + 4 + 4));
	var png_len = arr2u32(png_len_arr);
	console.log("png idx: " + png_idx);
	console.log("png len: " + png_len);
	if (png_idx + png_len > arr.byteLength - 4) {
		var err = "ERROR: PNG length exceeds file size";
		console.log(err);
	}
	else {
		var png_data = new Uint8Array(arr.slice(png_idx, png_idx + png_len - 4));
		var b64encoded = btoa(new Uint8Array(png_data).reduce(function (data, byte) {
			return data + String.fromCharCode(byte);
		}, ''));
		png_src = "data:image/png;base64," + b64encoded;
	}

	return {
		header: headerStr,
		stream: stream_content,
		stream_crc32: stream_crc32,
		metadata_split: metadata_split,
		metadata_raw: metadata_content_arr,
		metadata_crc32: metadata_crc32,
		commented_gcode: commented_gcode,
		png_data: png_data,
		png_src: png_src,
	};
}

function arr2u32(arr)
{
	var x = 0;
	x += arr[0] << (8 * 0);
	x += arr[1] << (8 * 1);
	x += arr[2] << (8 * 2);
	x += arr[3] << (8 * 3);
	return x;
}

function arr2float(arr)
{
	const view = new DataView(arr.buffer);
	return view.getFloat32(0, true);
}

function u32bytes(x)
{
	try {
		x = x.toFixed(0);
	}
	catch {
	}
	var arr = new Uint8Array(4);
	var view = new DataView(arr.buffer);
	view.setUint32(0, x, true);
	return arr;
}

function floatBytes(x)
{
	var arr = new Uint8Array(4);
	var view = new DataView(arr.buffer);
	view.setFloat32(0, x, true);
	return arr;
}

function byte2bitmap(dec){
	var bits = (dec >>> 0).toString(2);
	while (bits.length < 8) {
		bits = "0" + bits;
	}
	return bits;
	//return bits.split("").reverse().join("");
}

function formatHex(x, places, prepend) {
	var y = (x >>> 0).toString(16).toUpperCase();
	while (y.length < places) {
		y = "0" + y;
	}
	if (prepend.length > 0) {
		y = prepend + y;
	}
	return y;
}

// sorry about this function, it's not needed any more now that I've got the data structure more understood
function formatFloat(x, places)
{
	if (isNaN(x)) {
		return NaN;
	}
	if (places == 0)
	{
		if (x < 0.5 && x > -0.5)
		{
			return 0;
		}
	}
	else if (places == 1)
	{
		if (x < 0.05 && x > -0.05)
		{
			return 0;
		}
	}
	else if (places == 2)
	{
		if (x < 0.005 && x > -0.005)
		{
			return 0;
		}
	}
	else if (places == 3)
	{
		if (x < 0.0005 && x > -0.0005)
		{
			return 0;
		}
	}
	else if (places == 4)
	{
		if (x < 0.00005 && x > -0.00005)
		{
			return 0;
		}
	}
	else if (places == 5)
	{
		if (x < 0.000005 && x > -0.000005)
		{
			return 0;
		}
	}
	else if (places >= 6)
	{
		if (x < 0.0000005 && x > -0.0000005)
		{
			return 0;
		}
	}
	try
	{
		return x.toFixed(places);
	}
	catch (excep)
	{
		try
		{
			return Number(x).toFixed(places);
		}
		catch (excep2)
		{
			console.log("ERROR: exception calling x.toFixed(), msg: " + excep2.message);
			return 0;
		}
	}
}

function saveAsFile(arr, fname)
{
	var blob = new Blob([arr], {
		type: "text/plain;charset=utf-8"
	});
	saveAs(blob, fname);
}

function makeCrcTable()
{
	var c;
	var crc_tbl = [];
	for(var n = 0; n < 256; n++) {
		c = n;
		for(var k = 0; k < 8; k++) {
			c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
		}
		crc_tbl[n] = c;
	}
	return crc_tbl;
}

function crc32(arr, init_crc)
{
	var crcTable = window.crcTable || (window.crcTable = makeCrcTable());
	var crc = init_crc ^ (-1);

	for (var i = 0; i < arr.length; i++ ) {
		crc = (crc >>> 8) ^ crcTable[(crc ^ arr[i]) & 0xFF];
	}

	return ((crc ^ (-1)) >>> 0) & 0xFFFFFFFF;
}

function readNumber(str)
{
	if (typeof str !== 'string') {
		if (isNaN(str) == false) {
			return str;
		}
		else {
			return NaN;
		}
	}
	str = str.trim().toUpperCase();
	if (str.includes(" ") || str.includes("\t") || str.includes("\r") || str.includes("\n")) {
		return NaN;
	}
	if (str.startsWith("0X")) {
		return parseInt(str, 16);
	}
	if (str.startsWith("\\X")) {
		return parseInt("0x" + str.substring(2, str.length), 16);
	}
	if (str.startsWith("H")) {
		return parseInt("0x" + str.substring(1, str.length), 16);
	}
	if (str.endsWith("H")) {
		return parseInt("0x" + str.substring(0, str.length - 1), 16);
	}
	if (str.startsWith("0B")) {
		return parseInt(str.substring(2, str.length), 2);
	}
	if (str.startsWith("B")) {
		return parseInt(str.substring(1, str.length), 2);
	}
	if (str.includes(".")) {
		return parseFloat(str);
	}
	if (isNaN(str)) {
		return NaN;
	}
	return parseInt(str);
}

function arrayAddAlloc(arr, add)
{
	var i;
	var res = new Uint8Array(arr.length + add);
	for (i = 0; i < arr.length; i++) {
		res[i] = arr[i];
	}
}

function getNowTimeFormat() {
	var now = new Date();
	var s = "";
	s += now.getUTCFullYear() + "-"
	if (now.getUTCMonth() <= 8) {
		s += "0";
	}
	s += now.getUTCMonth() + "-";
	if (now.getUTCDate() <= 9) {
		s += "0";
	}
	s += now.getUTCDate() + "-";
	s += "T";
	if (now.getUTCHours() <= 9) {
		s += "0";
	}
	s += now.getUTCHours() + ":";
	if (now.getUTCMinutes() <= 9) {
		s += "0";
	}
	s += now.getUTCMinutes() + ":";
	if (now.getUTCSeconds() <= 9) {
		s += "0";
	}
	s += now.getUTCSeconds();
	s += "Z";
	return s;
}