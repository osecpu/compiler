LB 1 Code
	PLIMM P0 L1
	LIMM16 R0 2
	PADD R0 P0 P0 Code
	PADD R0 P0 P0 Code
	PLIMM P1 L1
	PCMPNE R0 P1 P0
/*
PDIF R0 P1 P0 Code
*/
/*
LIMM32 R3 -3456
LIMM32 R2 -3456
CMPL R0 R3 R2
*/
LB 2 Code
	CPDR R0
	END
