
var operand = function(type, byteIndex, bitOfs, binList, token){
	var v;
	switch(type){
		case "R":
			v = getRegNum(token, "R");
			break;
		case "T":
			v = getTypeNum(token);
			break;
		case "i16":
			v = parseInt16(token);
			break;
		case "i32":
			v = parseInt32(token);
			break;
		case "i24":
			v = parseInt24(token);
			break;
		default:
			throw "Unknown operand type: " + type
	}
	if(binList[byteIndex] === undefined) binList[byteIndex] = 0;
	binList[byteIndex] |= v << bitOfs;
	return binList;
}
var op = function(type, byteIndex, bitOfs){
	return function(binList, token){
		return operand(type, byteIndex, bitOfs, binList, token);
	}
}

var OSECPU_FPGA_INSTR_TYPE = {
	"OPONLY":	[],
	"LBSET":	[op("T", 0, 18), op("i16", 0, 0), op("i16", 1, 16), op("i16", 1, 0)],
	"LIMM16":	[op("R", 0, 18), op("i16", 0, 0)],
	"PLIMM":	[op("P", 0, 18), op("i16", 0, 0)],
	"CND":		[op("R", 0, 18)],
	"1R1PT":	[op("R", 0, 18), op("P", 0, 12), op("T", 0, 0)],
	"2PT":		[op("P", 0, 18), op("P", 0, 12), op("T", 0, 0)],
	"1R2PT":	[op("R", 0, 18), op("P", 0, 12), op("P", 0, 6), op("T", 0, 0)],
	"3R":		[op("R", 0, 18), op("R", 0, 12), op("R", 0, 6)],
	"PCP":		[op("P", 0, 12), op("P", 0, 6)],
	"1R2P":		[op("R", 0, 18), op("P", 0, 12), op("P", 0, 6)],
	"LIMM32":	[op("R", 0, 18), op("i32", 1, 0)],
	"CP":		[op("R", 0, 18), op("R", 0, 12)],
	"CPDR":		[op("R", 0, 12)],
	"IMM24":	[op("i24", 0, 0)],
}

var OSECPU_FPGA_INSTR_SET = {
	"NOP":		[0x00, "OPONLY"],
	"LBSET":	[0x01, "LBSET"],
	"LIMM16":	[0x02, "LIMM16"],
	"PLIMM":	[0x03, "PLIMM"],
	"CND":		[0x04, "CND"],
	"LMEM": 	[0x08, "1R1PT"],
	"SMEM": 	[0x09, "1R1PT"],
	"PLMEM":	[0x0A, "2PT"],
	"PSMEM":	[0x0B, "2PT"],
	"PADD":		[0x0E, "1R2PT"],
	"PDIF":		[0x0F, "1R2PT"],
	"OR":		[0x10, "3R"],
	"XOR":		[0x11, "3R"],
	"AND":		[0x12, "3R"],
	"ADD":		[0x14, "3R"],
	"SUB":		[0x15, "3R"],
	"MUL":		[0x16, "3R"],
	"SHL":		[0x18, "3R"],
	"SAR":		[0x19, "3R"],
	"DIV":		[0x1A, "3R"],
	"MOD":		[0x1B, "3R"],
	"PCP":		[0x1E, "PCP"],
	"CMPE":		[0x20, "3R"],
	"CMPNE":	[0x21, "3R"],
	"CMPL":		[0x22, "3R"],
	"CMPGE":	[0x23, "3R"],
	"CMPLE":	[0x24, "3R"],
	"CMPG":		[0x25, "3R"],
	"TSTZ":		[0x26, "3R"],
	"TSTNZ":	[0x27, "3R"],
	"PCMPE":	[0x28, "1R2P"],
	"PCMPNE":	[0x29, "1R2P"],
	"PCMPL":	[0x2A, "1R2P"],
	"PCMPGE":	[0x2B, "1R2P"],
	"PCMPLE":	[0x2C, "1R2P"],
	"PCMPG":	[0x2D, "1R2P"],
	"LIMM32":	[0xD0, "LIMM32"],
	"LMEMCONV":	[0xD1, "1R1PT"],
	"CP":		[0xD2, "CP"],
	"CPDR":		[0xD3, "CPDR"],
	"END":		[0xF0, "OPONLY"],
}

var OSECPU_FPGA_INSTR_MAP: any = {};
for(var k in OSECPU_FPGA_INSTR_SET){
	var instrDef = OSECPU_FPGA_INSTR_SET[k];
	var instrOperands = OSECPU_FPGA_INSTR_TYPE[instrDef[1]];
	if(instrOperands === undefined){
		console.error(
			"not found in INSTR_TYPE " + instrDef[1]);
		process.exit(1);
	}
	OSECPU_FPGA_INSTR_MAP[k] = 
		[instrDef[0]].concat(instrOperands);
}

class Assembler
{
	private tokenSeparatorList = [];
	private opTable: any;
	constructor(tokenSeparatorList: string[], opTable: any){
		this.tokenSeparatorList = tokenSeparatorList;
		this.opTable = opTable;
	}
	tokenize(input: string): string[]
	{
		var tokens = 
			input.splitByArraySeparatorSeparatedLong(this.tokenSeparatorList)
		tokens.removeAllObject(" ");
		tokens.removeAllObject("\t");
		tokens.removeAllObject("\n");
		return tokens;
	}
	toHexStr32(v: number): string
	{
		return ("00000000" + (v >>> 0).toString(16)).substr(-8);
	}
	compile(input: string)
	{
		var s = "";
		try{
			var tokenList = this.tokenize(input);
			for(var i = 0; i < tokenList.length; ){
				var mn = tokenList[i];
				if(this.opTable[mn] === undefined){
					throw "Unknown mnemonic: " + mn;
				}
				var opeRule = this.opTable[mn];
				var bin = [0];
				for(var k = 1; k < opeRule.length; k++){
					var token = tokenList[i + k];
					bin = opeRule[k](bin, tokenList[i + k]);
				}
				bin[0] |= opeRule[0] << 24;
				console.error("OP: " + opeRule[0].toString(16));
				s += this.toHexStr32(bin[0]) + "\n";
				if(bin[1] !== undefined) s += this.toHexStr32(bin[1]) + "\n";
				i += opeRule.length;
			}
			console.log(s);
		} catch(e){
			console.error(e);
			process.exit(1);
		}
	}
}

function getRegNum(token, type)
{
	if(token[0] != type) throw "Expected register type is " + type + ", but " + token[0];
	return parseInt(token.substr(1));
}
function getTypeNum(token)
{
	token = token.toUpperCase();
	switch(token){
		case "UNDEFINED": return 0x00;
		case "VPTR":		return 0x01;
		case "SINT8":		return 0x02;
		case "UINT8":		return 0x03;
		case "SINT16":		return 0x04;
		case "UINT16":		return 0x05;
		case "SINT32":		return 0x06;
		case "UINT32":		return 0x07;
		case "SINT4":		return 0x08;
		case "UINT4":		return 0x09;
		case "SINT2":		return 0x0A;
		case "UINT2":		return 0x0B;
		case "SINT1":		return 0x0C;
		case "UINT1":		return 0x0D;
		case "CODE": 		return 0x7F;
	}
	throw "Unexpected label type: " + token;
}
function shiftedOperand(v, index){
	// index: 0, 1, 2, 3
	return v << (18 - index * 6);
}
function shiftedOpecode(op){
	return op << 24;
}
function parseInt16(token: string)
{
	var num = parseInt(token);
	if(num < 0){
		num = num & 0xffff;
	} 
	return num;
}
function parseInt24(token: string)
{
	var num = parseInt(token);
	if(num < 0){
		num = num & 0xffffff;
	} 
	return num;
}
function parseInt32(token: string)
{
	return parseInt(token);
}

if(process.argv.length < 3){
	console.log("node compiler.js <source>");
	process.exit(0);
}

var fs = require('fs');
fs.readFile(process.argv[2], 'utf8', function (err, text) {
	if(err){
		console.log('File open failed. ' + err);
		process.exit(1);
	}
	var compiler = new Assembler([
		" ", "\t", "\n" 
	], OSECPU_FPGA_INSTR_MAP);
	compiler.compile(text);
});

