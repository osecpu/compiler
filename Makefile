ROM_PATH=../fpga/rom.hex

default:
	make rom.hex

compiler.js : compiler.ts Makefile
	tsc compiler.ts ext.ts --outfile compiler.js

%.hex : %.s compiler.js Makefile
	node compiler.js $*.s | tee rom.hex

clean:
	-rm *.hex
	-rm *.js

rom:
	make rom.hex
	cp rom.hex $(ROM_PATH)

