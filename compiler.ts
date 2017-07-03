
function getRegNum(token, type)
{
	if(token[0] != type) throw "Expected register type is " + type + ", but " + token[0];
	return parseInt(token.substr(1));
}
function shiftedOperand(v, index){
	// index: 0, 1, 2, 3
	return v << (18 - index * 6);
}
function shiftedOpecode(op){
	return op << 24;
}
	/*
class OSECPU_Instr{
	constructor(tokens: string[])
	{
		var op = 0;
		if(tokens[0] === "NOP"){
			op |= shiftedOpecode(0x00);
		} else if(tokens[0] === "LIMM16"){
			op |= shiftedOpecode(0x02);
			op |= shiftedOperand(getRegNum(tokens[1], "R"), 0);
			op |= shiftedOperand(parseInt(tokens[2]), 3);
		} else if(tokens[0] === "OR"){
			op |= shiftedOpecode(0x10);
			op |= shiftedOperand(getRegNum(tokens[1], "R"), 0);
			op |= shiftedOperand(getRegNum(tokens[2], "R"), 1);
			op |= shiftedOperand(getRegNum(tokens[3], "R"), 2);
		} else if(tokens[0] === "XOR"){
			op |= shiftedOpecode(0x11);
			op |= shiftedOperand(getRegNum(tokens[1], "R"), 0);
			op |= shiftedOperand(getRegNum(tokens[2], "R"), 1);
			op |= shiftedOperand(getRegNum(tokens[3], "R"), 2);
		} else if(tokens[0] === "AND"){
			op |= shiftedOpecode(0x12);
			op |= shiftedOperand(getRegNum(tokens[1], "R"), 0);
			op |= shiftedOperand(getRegNum(tokens[2], "R"), 1);
			op |= shiftedOperand(getRegNum(tokens[3], "R"), 2);
		} else if(tokens[0] === "ADD"){
			op |= shiftedOpecode(0x14);
			op |= shiftedOperand(getRegNum(tokens[1], "R"), 0);
			op |= shiftedOperand(getRegNum(tokens[2], "R"), 1);
			op |= shiftedOperand(getRegNum(tokens[3], "R"), 2);
		} else if(tokens[0] === "SUB"){
			op |= shiftedOpecode(0x15);
			op |= shiftedOperand(getRegNum(tokens[1], "R"), 0);
			op |= shiftedOperand(getRegNum(tokens[2], "R"), 1);
			op |= shiftedOperand(getRegNum(tokens[3], "R"), 2);
		} else if(tokens[0] === "CP"){
			op |= shiftedOpecode(0xD2);
			op |= shiftedOperand(getRegNum(tokens[1], "R"), 0);
			op |= shiftedOperand(getRegNum(tokens[2], "R"), 1);
		} else if(tokens[0] === "END"){
			op |= shiftedOpecode(0xF0);
		} else{
			throw "Unknown Mnemonic " + tokens[0];
		}
		binStr += ("00000000" + op.toString(16)).substr(-8) + "\n";
	}
}
	 */
function OSECPU_FPGA_compile(str){
	 var lines = str.split("\n");
	var binStr = "";
	for(var i = 0; i < lines.length; i++){
		var tokens = lines[i].trim().split(" ");
		for(var k = 0; k < tokens.length; k++){
			if(tokens[k] === ""){
				tokens.splice(k);
				k--;
			}
		}
		if(tokens.length > 0){
			var op = 0;
			var opCode = 0;
			if(tokens[0] === "NOP"){
				opCode = 0;;
			} else if(tokens[0] === "LIMM16"){
				opCode = 0x02;
				op |= shiftedOperand(getRegNum(tokens[1], "R"), 0);
				op |= shiftedOperand(parseInt(tokens[2]), 3);
			} else if(tokens[0] === "OR"){
				opCode = 0x10;
				op |= shiftedOperand(getRegNum(tokens[1], "R"), 0);
				op |= shiftedOperand(getRegNum(tokens[2], "R"), 1);
				op |= shiftedOperand(getRegNum(tokens[3], "R"), 2);
			} else if(tokens[0] === "XOR"){
				opCode = 0x11;
				op |= shiftedOperand(getRegNum(tokens[1], "R"), 0);
				op |= shiftedOperand(getRegNum(tokens[2], "R"), 1);
				op |= shiftedOperand(getRegNum(tokens[3], "R"), 2);
			} else if(tokens[0] === "AND"){
				opCode = 0x12;
				op |= shiftedOperand(getRegNum(tokens[1], "R"), 0);
				op |= shiftedOperand(getRegNum(tokens[2], "R"), 1);
				op |= shiftedOperand(getRegNum(tokens[3], "R"), 2);
			} else if(tokens[0] === "ADD"){
				opCode = 0x14;
				op |= shiftedOperand(getRegNum(tokens[1], "R"), 0);
				op |= shiftedOperand(getRegNum(tokens[2], "R"), 1);
				op |= shiftedOperand(getRegNum(tokens[3], "R"), 2);
			} else if(tokens[0] === "SUB"){
				opCode = 0x15;
				op |= shiftedOperand(getRegNum(tokens[1], "R"), 0);
				op |= shiftedOperand(getRegNum(tokens[2], "R"), 1);
				op |= shiftedOperand(getRegNum(tokens[3], "R"), 2);
			} else if(tokens[0] === "CP"){
				opCode = 0xD2;
				op |= shiftedOperand(getRegNum(tokens[1], "R"), 0);
				op |= shiftedOperand(getRegNum(tokens[2], "R"), 1);
			} else if(tokens[0] === "CPDR"){
				opCode = 0xD3;
				op |= shiftedOperand(getRegNum(tokens[1], "R"), 1);
			} else if(tokens[0] === "END"){
				opCode = 0xF0;
			} else{
				throw "Unknown Mnemonic " + tokens[0];
			}
			binStr += ("00" + opCode.toString(16)).substr(-2) + 
				("000000" + op.toString(16)).substr(-6) + "\n";
		}
	}
	return binStr;
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
	console.error('Compilation begin:');
	var retv = null;
	try{
		retv = OSECPU_FPGA_compile(text);
	} catch(e){
		console.log(e);
	}
	console.error('Compilation end:');
	console.log(retv);
});

