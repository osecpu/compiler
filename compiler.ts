
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

var OSECPU_FPGA_INSTR_SET = {
	"NOP":	[
		0x00,
	],
	"LBSET":[
		0x01, 
		op("T", 0, 18), op("i16", 0, 0), op("i16", 1, 16), op("i16", 1, 0),
	],
	"LIMM16":[
		0x02, 
		op("R", 0, 18), op("i16", 0, 0),
	],
	"SAR":[
		0x19, 
		op("R", 0, 18), op("R", 0, 12), op("R", 0, 6),
	],
	"CP":[
		0xD2, 
		op("R", 0, 18), op("R", 0, 12),
	],
	"CPDR":[
		0xD3, 
		op("R", 0, 12),
	],
	"END":	[
		0xF0,
	],
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
		case "CODE": return 0x86;
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
	], OSECPU_FPGA_INSTR_SET);
	compiler.compile(text);
});

