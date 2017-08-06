var OSECPU;
(function (OSECPU) {
    OSECPU.ROM_SIZE = 4096;
})(OSECPU || (OSECPU = {}));
var operand = function (type, byteIndex, bitOfs, binList, token) {
    var v;
    switch (type) {
        case "R":
            v = getRegNum(token, "R");
            break;
        case "P":
            v = getRegNum(token, "P");
            break;
        case "L":
            v = getLabelNum(token);
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
            throw "Unknown operand type: " + type;
    }
    if (binList[byteIndex] === undefined)
        binList[byteIndex] = 0;
    binList[byteIndex] |= v << bitOfs;
    return binList;
};
var op = function (type, byteIndex, bitOfs) {
    return function (binList, token) {
        return operand(type, byteIndex, bitOfs, binList, token);
    };
};
var OSECPU_FPGA_INSTR_TYPE = {
    "OPONLY": [],
    "LBSET": [op("T", 0, 18), op("L", 0, 0), op("i16", 1, 16), op("i16", 1, 0)],
    "LIMM16": [op("R", 0, 18), op("i16", 0, 0)],
    "PLIMM": [op("P", 0, 18), op("L", 0, 0)],
    "CND": [op("R", 0, 18)],
    "1R1PT": [op("R", 0, 18), op("P", 0, 12), op("T", 0, 0)],
    "2PT": [op("P", 0, 18), op("P", 0, 12), op("T", 0, 0)],
    "1R2PT": [op("R", 0, 18), op("P", 0, 12), op("P", 0, 6), op("T", 0, 0)],
    "3R": [op("R", 0, 18), op("R", 0, 12), op("R", 0, 6)],
    "PCP": [op("P", 0, 12), op("P", 0, 6)],
    "1R2P": [op("R", 0, 18), op("P", 0, 12), op("P", 0, 6)],
    "LIMM32": [op("R", 0, 18), op("i32", 1, 0)],
    "CP": [op("R", 0, 18), op("R", 0, 12)],
    "CPDR": [op("R", 0, 12)],
    "IMM24": [op("i24", 0, 0)]
};
var OSECPU_FPGA_INSTR_SET = {
    "NOP": [0x00, "OPONLY"],
    "LBSET": [0x01, "LBSET"],
    "LIMM16": [0x02, "LIMM16"],
    "PLIMM": [0x03, "PLIMM"],
    "CND": [0x04, "CND"],
    "LMEM": [0x08, "1R1PT"],
    "SMEM": [0x09, "1R1PT"],
    "PLMEM": [0x0A, "2PT"],
    "PSMEM": [0x0B, "2PT"],
    "PADD": [0x0E, "1R2PT"],
    "PDIF": [0x0F, "1R2PT"],
    "OR": [0x10, "3R"],
    "XOR": [0x11, "3R"],
    "AND": [0x12, "3R"],
    "ADD": [0x14, "3R"],
    "SUB": [0x15, "3R"],
    "MUL": [0x16, "3R"],
    "SHL": [0x18, "3R"],
    "SAR": [0x19, "3R"],
    "DIV": [0x1A, "3R"],
    "MOD": [0x1B, "3R"],
    "PCP": [0x1E, "PCP"],
    "CMPE": [0x20, "3R"],
    "CMPNE": [0x21, "3R"],
    "CMPL": [0x22, "3R"],
    "CMPGE": [0x23, "3R"],
    "CMPLE": [0x24, "3R"],
    "CMPG": [0x25, "3R"],
    "TSTZ": [0x26, "3R"],
    "TSTNZ": [0x27, "3R"],
    "PCMPE": [0x28, "1R2P"],
    "PCMPNE": [0x29, "1R2P"],
    "PCMPL": [0x2A, "1R2P"],
    "PCMPGE": [0x2B, "1R2P"],
    "PCMPLE": [0x2C, "1R2P"],
    "PCMPG": [0x2D, "1R2P"],
    "LIMM32": [0xD0, "LIMM32"],
    "LMEMCONV": [0xD1, "1R1PT"],
    "CP": [0xD2, "CP"],
    "CPDR": [0xD3, "CPDR"],
    "END": [0xF0, "OPONLY"]
};
var OSECPU_FPGA_INSTR_MAP = {};
for (var k in OSECPU_FPGA_INSTR_SET) {
    var instrDef = OSECPU_FPGA_INSTR_SET[k];
    var instrOperands = OSECPU_FPGA_INSTR_TYPE[instrDef[1]];
    if (instrOperands === undefined) {
        console.error("not found in INSTR_TYPE " + instrDef[1]);
        process.exit(1);
    }
    OSECPU_FPGA_INSTR_MAP[k] =
        [instrDef[0]].concat(instrOperands);
}
var Instr = (function () {
    function Instr(opTable, tokenList, index) {
        var mn = tokenList[index];
        this.opeRule = opTable[mn];
        if (this.opeRule === undefined) {
            throw "Unknown mnemonic: " + mn;
        }
        this.bin = [0];
        for (var k = 1; k < this.opeRule.length; k++) {
            var token = tokenList[index + k];
            this.bin = this.opeRule[k](this.bin, tokenList[index + k]);
        }
        this.bin[0] |= this.opeRule[0] << 24;
        console.error("mn: " + mn);
    }
    Instr.prototype.getTokenCount = function () {
        return this.opeRule.length;
    };
    Instr.prototype.getBin = function () {
        return this.bin;
    };
    return Instr;
}());
var CodeBlock = (function () {
    function CodeBlock(LBID, type) {
        this.codeList = [];
        this.LBID = LBID;
        this.type = type;
    }
    CodeBlock.prototype.appendCode = function (bin) {
        this.codeList.push(bin[0]);
        if (bin[1] !== undefined)
            this.codeList.push(bin[1]);
    };
    CodeBlock.prototype.getSize = function () {
        return this.codeList.length;
    };
    CodeBlock.prototype.getHexStr = function () {
        var s = "";
        for (var i = 0; i < this.codeList.length; i++) {
            s += this.toHexStr32(this.codeList[i]) + "\n";
        }
        return s;
    };
    CodeBlock.prototype.getLBID = function () {
        return this.LBID;
    };
    CodeBlock.prototype.genLBSETInstr = function (opTable, ofs) {
        return new Instr(opTable, [
            "LBSET",
            this.type,
            "L" + this.getLBID(),
            ofs.toString(),
            this.getLabelDataCount().toString(),
        ], 0);
    };
    CodeBlock.prototype.getLabelDataCount = function () {
        if (this.type.toUpperCase() === "CODE") {
            return 1;
        }
        else {
            return this.getSize();
        }
    };
    CodeBlock.prototype.toHexStr32 = function (v) {
        return ("00000000" + (v >>> 0).toString(16)).substr(-8);
    };
    return CodeBlock;
}());
var Assembler = (function () {
    function Assembler(tokenSeparatorList, opTable) {
        this.tokenSeparatorList = [];
        this.tokenSeparatorList = tokenSeparatorList;
        this.opTable = opTable;
    }
    Assembler.prototype.tokenize = function (input) {
        var tokens = input.splitByArraySeparatorSeparatedLong(this.tokenSeparatorList);
        tokens.removeAllObject(" ");
        tokens.removeAllObject("\t");
        for (;;) {
            var pL = tokens.indexOf("/*");
            if (pL == -1)
                break;
            var pR = tokens.indexOf("*/", pL);
            if (pR == -1)
                throw "Expected */, but not found.";
            tokens.splice(pL, pR - pL + 1);
        }
        tokens.removeAllObject("\n");
        return tokens;
    };
    Assembler.prototype.compile = function (input) {
        var s = "";
        try {
            var tokenList = this.tokenize(input);
            var codeBlockList = [];
            var currentBlock = undefined;
            for (var i = 0; i < tokenList.length;) {
                var mn = tokenList[i];
                if (mn.substr(0, 2) === "LB") {
                    // new block
                    var lbNum = parseInt(tokenList[i + 1]);
                    getTypeNum(tokenList[i + 2]); // check
                    if (isNaN(lbNum)) {
                        throw "Expected lbNum, but " + tokenList[i + 1];
                    }
                    currentBlock = new CodeBlock(lbNum, tokenList[i + 2]);
                    codeBlockList.push(currentBlock);
                    i += 3;
                }
                else {
                    if (currentBlock === undefined) {
                        throw "You need define label before code body";
                    }
                    var instr = new Instr(this.opTable, tokenList, i);
                    var bin = instr.getBin();
                    currentBlock.appendCode(bin);
                    i += instr.getTokenCount();
                }
            }
            console.error(codeBlockList);
            // generate LBSET instr
            var binStr = "";
            var header = new CodeBlock();
            var ofs = codeBlockList.length * 2;
            for (var i = 0; i < codeBlockList.length; i++) {
                var block = codeBlockList[i];
                var instr = block.genLBSETInstr(this.opTable, ofs);
                var bin = instr.getBin();
                header.appendCode(bin);
                ofs += block.getSize();
            }
            codeBlockList.unshift(header);
            // Generate HEX file
            for (var i = 0; i < codeBlockList.length; i++) {
                s += codeBlockList[i].getHexStr();
            }
            for (var i = ofs; i < OSECPU.ROM_SIZE; i++) {
                s += "00000000\n";
            }
            //
            process.stdout.write(s);
        }
        catch (e) {
            console.error(e);
            process.exit(1);
        }
    };
    return Assembler;
}());
function getLabelNum(token) {
    if (token[0] != "L")
        throw "Expected label identifier, but " + token[0];
    var lbnum = parseInt(token.substr(1));
    if (lbnum < 0 || 0x1000 <= lbnum) {
        throw "Out of bounds for label number (0-4095)";
    }
    return lbnum;
}
function getRegNum(token, type) {
    if (token[0] != type)
        throw "Expected register type is " + type + ", but " + token[0];
    return parseInt(token.substr(1), 16);
}
function getTypeNum(token) {
    token = token.toUpperCase();
    switch (token) {
        case "UNDEFINED": return 0x00;
        case "VPTR": return 0x01;
        case "SINT8": return 0x02;
        case "UINT8": return 0x03;
        case "SINT16": return 0x04;
        case "UINT16": return 0x05;
        case "SINT32": return 0x06;
        case "UINT32": return 0x07;
        case "SINT4": return 0x08;
        case "UINT4": return 0x09;
        case "SINT2": return 0x0A;
        case "UINT2": return 0x0B;
        case "SINT1": return 0x0C;
        case "UINT1": return 0x0D;
        case "CODE": return 0x3F;
    }
    throw "Unexpected label type: " + token;
}
function shiftedOperand(v, index) {
    // index: 0, 1, 2, 3
    return v << (18 - index * 6);
}
function shiftedOpecode(op) {
    return op << 24;
}
function parseInt16(token) {
    var num = parseInt(token);
    if (num < 0) {
        num = num & 0xffff;
    }
    return num;
}
function parseInt24(token) {
    var num = parseInt(token);
    if (num < 0) {
        num = num & 0xffffff;
    }
    return num;
}
function parseInt32(token) {
    return parseInt(token);
}
if (process.argv.length < 3) {
    console.log("node compiler.js <source>");
    process.exit(0);
}
var fs = require('fs');
fs.readFile(process.argv[2], 'utf8', function (err, text) {
    if (err) {
        console.log('File open failed. ' + err);
        process.exit(1);
    }
    var compiler = new Assembler([
        " ", "\t", "\n", "/*", "*/"
    ], OSECPU_FPGA_INSTR_MAP);
    compiler.compile(text);
});
;
Array.prototype.removeAllObject = function (anObject) {
    //Array中にある全てのanObjectを削除し、空いた部分は前につめる。
    //戻り値は削除が一回でも実行されたかどうか
    var ret = false;
    for (var i = 0; i < this.length; i++) {
        if (this[i] == anObject) {
            this.splice(i, 1);
            ret = true;
            i--;
        }
    }
    return ret;
};
Array.prototype.removeAnObject = function (anObject, fEqualTo) {
    //Array中にある最初のanObjectを削除し、空いた部分は前につめる。
    //fEqualToは省略可能で、評価関数fEqualTo(array[i], obj)を設定する。
    //戻り値は削除が実行されたかどうか
    if (!(fEqualTo instanceof Function)) {
        fEqualTo = function (a, b) { return (a == b); };
    }
    for (var i = 0; i < this.length; i++) {
        if (fEqualTo(this[i], anObject)) {
            this.splice(i, 1);
            return true;
        }
    }
    return false;
};
Array.prototype.removeByIndex = function (index, length) {
    //Array[index]を削除し、空いた部分は前につめる。
    if (length === undefined) {
        length = 1;
    }
    this.splice(index, length);
    return;
};
Array.prototype.insertAtIndex = function (index, data) {
    this.splice(index, 0, data);
    return;
};
Array.prototype.symmetricDifferenceWith = function (b, fEqualTo) {
    // 対称差(XOR)集合を求める
    // fEqualToは省略可能で、評価関数fEqualTo(a[i], b[j])を設定する。
    var a = this.copy();
    var ei;
    for (var i = 0, len = b.length; i < len; i++) {
        ei = a.getIndex(b[i], fEqualTo);
        if (ei != -1) {
            a.removeByIndex(ei);
        }
        else {
            a.push(b[i]);
        }
    }
    return a;
};
Array.prototype.intersectionWith = function (b, fEqualTo) {
    //積集合（AND）を求める
    //fEqualToは省略可能で、評価関数fEqualTo(a[i], b[j])を設定する。
    var r = new Array();
    for (var i = 0, len = b.length; i < len; i++) {
        if (this.includes(b[i], fEqualTo)) {
            r.push(b[i]);
        }
    }
    return r;
};
Array.prototype.unionWith = function (b, fEqualTo) {
    //和集合（OR）を求める
    //fEqualToは省略可能で、評価関数fEqualTo(a[i], b[j])を設定する。
    var r = new Array();
    for (var i = 0, len = b.length; i < len; i++) {
        if (!this.includes(b[i], fEqualTo)) {
            r.push(b[i]);
        }
    }
    return this.concat(r);
};
Array.prototype.isEqualTo = function (b, fEqualTo) {
    //retv: false or true.
    //二つの配列が互いに同じ要素を同じ個数だけ持つか調べる。
    //fEqualToは省略可能で、評価関数fEqualTo(a[i], b[i])を設定する。
    //fEqualToが省略された場合、二要素が全く同一のオブジェクトかどうかによって評価される。
    var i, iLen;
    if (!(b instanceof Array) || this.length !== b.length) {
        return false;
    }
    iLen = this.length;
    if (fEqualTo == undefined) {
        for (i = 0; i < iLen; i++) {
            if (this[i] !== b[i]) {
                break;
            }
        }
    }
    else {
        for (i = 0; i < iLen; i++) {
            if (fEqualTo(this[i], b[i])) {
                break;
            }
        }
    }
    if (i === iLen) {
        return true;
    }
    return false;
};
Array.prototype.includes = function (obj, fEqualTo) {
    //含まれている場合は配列内のそのオブジェクトを返す
    //fEqualToは省略可能で、評価関数fEqualTo(array[i], obj)を設定する。
    if (fEqualTo == undefined) {
        for (var i = 0, len = this.length; i < len; i++) {
            if (this[i] == obj) {
                return this[i];
            }
        }
    }
    else {
        for (var i = 0, len = this.length; i < len; i++) {
            if (fEqualTo(this[i], obj)) {
                return this[i];
            }
        }
    }
    return false;
};
Array.prototype.getIndex = function (obj, fEqualTo) {
    // 含まれている場合は配列内におけるそのオブジェクトの添字を返す。
    // 見つからなかった場合、-1を返す。
    //fEqualToは省略可能で、評価関数fEqualTo(array[i], obj)を設定する。
    if (fEqualTo == undefined) {
        for (var i = 0, len = this.length; i < len; i++) {
            if (this[i] == obj) {
                return i;
            }
        }
    }
    else {
        for (var i = 0, len = this.length; i < len; i++) {
            if (fEqualTo(this[i], obj)) {
                return i;
            }
        }
    }
    return -1;
};
Array.prototype.getAllMatched = function (obj, fEqualTo) {
    // 評価関数が真となる要素をすべて含んだ配列を返す。
    // 返すべき要素がない場合は空配列を返す。
    // fEqualToは省略可能で、評価関数fEqualTo(array[i], obj)を設定する。
    var retArray = new Array();
    if (fEqualTo == undefined) {
        for (var i = 0, len = this.length; i < len; i++) {
            if (this[i] == obj) {
                retArray.push(this[i]);
            }
        }
    }
    else {
        for (var i = 0, len = this.length; i < len; i++) {
            if (fEqualTo(this[i], obj)) {
                retArray.push(this[i]);
            }
        }
    }
    return retArray;
};
/*
Array.prototype.last = function(n){
    var n = (n === undefined) ? 1 : n;
    return this[this.length - n];
}
Array.prototype.search2DLineIndex = function(column, obj, fEqualTo){
    //与えられた配列を二次元配列として解釈し
    //array[n][column]がobjと等価になる最初の行nを返す。
    //fEqualToは省略可能で、評価関数fEqualTo(array[n][column], obj)を設定する。
    //該当する行がなかった場合、戻り値はundefinedとなる。
    if(fEqualTo == undefined){
        for(var i = 0, iLen = this.length; i < iLen; i++){
            if(this[i] instanceof Array && this[i][column] == obj){
                return i;
            }
        }
    } else{
        for(var i = 0, iLen = this.length; i < iLen; i++){
            if(this[i] instanceof Array && fEqualTo(this[i][column], obj)){
                return i;
            }
        }
    }
    return undefined;
}
Array.prototype.search2DObject = function(searchColumn, retvColumn, obj, fEqualTo){
    //与えられた配列を二次元配列として解釈し
    //array[n][searchColumn]がobjと等価になる最初の行のオブジェクトarray[n][retvColumn]を返す。
    //fEqualToは省略可能で、評価関数fEqualTo(array[n][searchColumn], obj)を設定する。
    //該当する行がなかった場合、戻り値はundefinedとなる。
    if(fEqualTo == undefined){
        for(var i = 0, iLen = this.length; i < iLen; i++){
            if(this[i] instanceof Array && this[i][searchColumn] == obj){
                return this[i][retvColumn];
            }
        }
    } else{
        for(var i = 0, iLen = this.length; i < iLen; i++){
            if(this[i] instanceof Array && fEqualTo(this[i][searchColumn], obj)){
                return this[i][retvColumn];
            }
        }
    }
    return undefined;
}
*/
Array.prototype.pushUnique = function (obj, fEqualTo) {
    //値が既に存在する場合は追加しない。評価関数fEqualTo(array[i], obj)を設定することができる。
    //結果的に配列内にあるオブジェクトが返される。
    var o = this.includes(obj, fEqualTo);
    if (!o) {
        this.push(obj);
        return obj;
    }
    return o;
};
Array.prototype.stableSort = function (f) {
    // http://blog.livedoor.jp/netomemo/archives/24688861.html
    // Chrome等ではソートが必ずしも安定ではないので、この関数を利用する。
    if (f == undefined) {
        f = function (a, b) { return a - b; };
    }
    for (var i = 0; i < this.length; i++) {
        this[i].__id__ = i;
    }
    this.sort.call(this, function (a, b) {
        var ret = f(a, b);
        if (ret == 0) {
            return (a.__id__ > b.__id__) ? 1 : -1;
        }
        else {
            return ret;
        }
    });
    for (var i = 0; i < this.length; i++) {
        delete this[i].__id__;
    }
};
/*
Array.prototype.splitByArray = function(separatorList){
    //Array中の文字列をseparatorList内の文字列でそれぞれで分割し、それらの文字列が含まれた配列を返す。
    var retArray = new Array();
    
    for(var i = 0, iLen = this.length; i < iLen; i++){
        retArray = retArray.concat(this[i].splitByArray(separatorList));
    }
    
    return retArray;
}
*/
Array.prototype.propertiesNamed = function (pName) {
    //Array内の各要素のプロパティpNameのリストを返す。
    var retArray = new Array();
    for (var i = 0, iLen = this.length; i < iLen; i++) {
        retArray.push(this[i][pName]);
    }
    return retArray;
};
/*
Array.prototype.logAsHexByte = function(logfunc){
    //十六進バイト列としてデバッグ出力する。
    //logfuncは省略時はconsole.logとなる。
    if(logfunc === undefined){
        logfunc = function(s){ console.log(s); };
    }
    var ds = "";
    for(var i = 0, iLen = this.length; i < iLen; i++){
        ds += ("00" + this[i].toString(16).toUpperCase()).slice(-2);
    }
    logfunc(ds);
}
Array.prototype.stringAsHexByte = function(){
    //十六進バイト列として文字列を得る
    var ds = "";
    for(var i = 0, iLen = this.length; i < iLen; i++){
        ds += ("00" + this[i].toString(16).toUpperCase()).slice(-2);
    }
    return ds;
}
Array.prototype.logEachPropertyNamed = function(pname, logfunc, suffix){
    //Arrayのすべての各要素pについて、プロパティp[pname]を文字列としてlogfuncの引数に渡して呼び出す。
    //suffixは各文字列の末尾に追加する文字列。省略時は改行文字となる。
    //logfuncは省略時はconsole.logとなる。
    if(logfunc === undefined){
        logfunc = function(s){ console.log(s); };
    }
    if(suffix === undefined){
        suffix = "\n";
    }
    for(var i = 0, iLen = this.length; i < iLen; i++){
        logfunc(this[i][pname] + suffix);
    }
}

Array.prototype.logEachPropertiesNamed = function(pnames, logfunc,　separator, suffix){
    //Arrayのすべての各要素pについて、プロパティp[pnames[n]]を文字列としてlogfuncの引数に渡して呼び出す。
    //suffixは各文字列の末尾に追加する文字列。省略時は改行文字となる。
    //separatorは各項目の間に置かれる文字列。省略時は",\t"となる。
    //logfuncは省略時はconsole.logとなる。
    if(logfunc === undefined){
        logfunc = function(s){ console.log(s); };
    }
    if(suffix === undefined){
        suffix = "\n";
    }
    if(separator === undefined){
        separator = ",\t";
    }
    var kLen = pnames.length - 1;
    for(var i = 0, iLen = this.length; i < iLen; i++){
        var s = "";
        for(var k = 0; k < kLen; k++){
            s += this[i][pnames[k]] + separator;
        }
        if(kLen != -1){
            s += this[i][pnames[k]] + suffix;
        }
        logfunc(s);
    }
}
*/
Array.prototype.copy = function () {
    return (new Array()).concat(this);
};
//文字列関連
String.prototype.replaceAll = function (org, dest) {
    //String中にある文字列orgを文字列destにすべて置換する。
    //http://www.syboos.jp/webjs/doc/string-replace-and-replaceall.html
    return this.split(org).join(dest);
};
/*
String.prototype.compareLeftHand = function (search){
    //前方一致長を求める。
    for(var i = 0; search.charAt(i) != ""; i++){
        if(search.charAt(i) != this.charAt(i)){
            break;
        }
    }
    return i;
}

String.prototype.splitByArray = function(separatorList){
    //リスト中の文字列それぞれで分割された配列を返す。
    //separatorはそれ以前の文字列の末尾に追加された状態で含まれる。
    //"abcdefg".splitByArray(["a", "e", "g"]);
    //	= ["a", "bcde", "fg"]
    var retArray = new Array();
    retArray[0] = this;
    
    for(var i = 0; i < separatorList.length; i++){
        var tmpArray = new Array();
        for(var k = 0; k < retArray.length; k++){
            tmpArray[k] = retArray[k].split(separatorList[i]);
            if(tmpArray[k][tmpArray[k].length - 1] == ""){
                tmpArray[k].splice(tmpArray[k].length - 1, 1);
                if(tmpArray[k] && tmpArray[k].length > 0){
                    for(var m = 0; m < tmpArray[k].length; m++){
                        tmpArray[k][m] += separatorList[i];
                    }
                }
            } else{
                for(var m = 0; m < tmpArray[k].length - 1; m++){
                    tmpArray[k][m] += separatorList[i];
                }
            }
        }
        retArray = new Array();
        retArray = retArray.concat.apply(retArray, tmpArray);
    }
    
    if(retArray.length == 0){
        // https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/split
        //文字列が空であるとき、split メソッドは、空の配列ではなく、1 つの空文字列を含む配列を返します。
        retArray.push("");
    }
    
    return retArray;
}

String.prototype.splitByArraySeparatorSeparated = function(separatorList){
    //リスト中の文字列それぞれで分割された配列を返す。
    //separatorも分割された状態で含まれる。
    //"abcdefg".splitByArraySeparatorSeparated(["a", "e", "g"]);
    //	= ["a", "bcd", "e", "f", "g"]
    var retArray = new Array();
    retArray[0] = this;
    
    for(var i = 0; i < separatorList.length; i++){
        var tmpArray = new Array();
        for(var k = 0; k < retArray.length; k++){
            var tmpArraySub = retArray[k].split(separatorList[i]);
            tmpArray[k] = new Array();
            for(var m = 0, mLen = tmpArraySub.length - 1; m < mLen; m++){
                if(tmpArraySub[m] != ""){
                    tmpArray[k].push(tmpArraySub[m]);
                }
                tmpArray[k].push(separatorList[i]);
            }
            if(tmpArraySub[tmpArraySub.length - 1] != ""){
                tmpArray[k].push(tmpArraySub[m]);
            }
        }
        retArray = new Array();
        retArray = retArray.concat.apply(retArray, tmpArray);
    }
    
    if(retArray.length == 0){
        // https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/split
        //文字列が空であるとき、split メソッドは、空の配列ではなく、1 つの空文字列を含む配列を返します。
        retArray.push("");
    }
    
    return retArray;
}
*/
String.prototype.splitByArraySeparatorSeparatedLong = function (separatorList) {
    //リスト中の文字列それぞれで分割された配列を返す。
    //separatorも分割された状態で含まれる。
    //separatorListの前の方にあるseparatorは、後方のseparatorによって分割されない。
    //"abcdefgcdefg".splitByArraySeparatorSeparatedLong(["bcde", "cd", "f"]);
    //	= ["a", "bcde", "f", "g", "cd", "e", "f", "g"]
    //"for (i = 0; i != 15; i++) {".splitByArraySeparatorSeparatedLong(["!=", "(", ")", "="]);
    //	= ["for ", "(", "i ", "=", " 0; i ", "!=", " 15; i++", ")", " {"]
    var retArray = new Array();
    var checkArray = new Array();
    retArray[0] = this;
    checkArray[0] = false;
    for (var i = 0; i < separatorList.length; i++) {
        var tmpArray = new Array();
        var tmpCheckArray = new Array();
        for (var k = 0; k < retArray.length; k++) {
            if (!checkArray[k]) {
                var tmpArraySub = retArray[k].split(separatorList[i]);
                tmpArray[k] = new Array();
                tmpCheckArray[k] = new Array();
                for (var m = 0, mLen = tmpArraySub.length - 1; m < mLen; m++) {
                    if (tmpArraySub[m] != "") {
                        tmpArray[k].push(tmpArraySub[m]);
                        tmpCheckArray[k].push(false);
                    }
                    tmpArray[k].push(separatorList[i]);
                    tmpCheckArray[k].push(true);
                }
                if (tmpArraySub[tmpArraySub.length - 1] != "") {
                    tmpArray[k].push(tmpArraySub[m]);
                    tmpCheckArray[k].push(false);
                }
            }
            else {
                tmpArray.push([retArray[k]]);
                tmpCheckArray.push([true]);
            }
        }
        retArray = new Array();
        checkArray = new Array();
        retArray = retArray.concat.apply(retArray, tmpArray);
        checkArray = checkArray.concat.apply(checkArray, tmpCheckArray);
    }
    if (retArray.length == 0) {
        // https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/String/split
        //文字列が空であるとき、split メソッドは、空の配列ではなく、1 つの空文字列を含む配列を返します。
        retArray.push("");
    }
    return retArray;
};
/*
String.prototype.trim = function(str){
    return this.replace(/^[ 　	]+|[ 　	]+$/g, "").replace(/\n$/g, "");
}
//http://d.hatena.ne.jp/favril/20090514/1242280476
String.prototype.isKanjiAt = function(index){
    var u = this.charCodeAt(index);
    if( (0x4e00  <= u && u <= 0x9fcf) ||	// CJK統合漢字
        (0x3400  <= u && u <= 0x4dbf) ||	// CJK統合漢字拡張A
        (0x20000 <= u && u <= 0x2a6df) ||	// CJK統合漢字拡張B
        (0xf900  <= u && u <= 0xfadf) ||	// CJK互換漢字
        (0x2f800 <= u && u <= 0x2fa1f)){ 	// CJK互換漢字補助
        return true;
    }
    return false;
}
String.prototype.isHiraganaAt = function(index){
    var u = this.charCodeAt(index);
    if(0x3040 <= u && u <= 0x309f){
        return true;
    }
    return false;
}
String.prototype.isKatakanaAt = function(index){
    var u = this.charCodeAt(index);
    if(0x30a0 <= u && u <= 0x30ff){
        return true;
    }
    return false;
}
String.prototype.isHankakuKanaAt = function(index){
    var u = this.charCodeAt(index);
    if(0xff61 <= u && u <= 0xff9f){
        return true;
    }
    return false;
}
*/
String.prototype.escapeForHTML = function () {
    var e = document.createElement('div');
    e.appendChild(document.createTextNode(this));
    return e.innerHTML;
};
// http://stackoverflow.com/questions/641857/javascript-window-resize-event
// addEvent(window, "resize", function_reference);
var addEvent = function (elem, type, eventHandle) {
    if (elem == null || typeof (elem) == 'undefined')
        return;
    if (elem.addEventListener) {
        elem.addEventListener(type, eventHandle, false);
    }
    else if (elem.attachEvent) {
        elem.attachEvent("on" + type, eventHandle);
    }
    else {
        elem["on" + type] = eventHandle;
    }
};
