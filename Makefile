ROM_PATH=../fpga/rom.hex

default:
	make compiler.js

compiler.js : compiler.ts Makefile
	tsc compiler.ts

%.hex : %.s compiler.js Makefile
	node compiler.js $*.s > $*.hex

clean:
	-rm *.hex

rom:
	make rom.hex
	cp rom.hex $(ROM_PATH)
