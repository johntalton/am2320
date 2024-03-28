//
export const REGISTERS = {
	HUMIDITY_HIGH: 0x00,
	HUMIDITY_LOW: 0x01,
	TEMPERATURE_HIGH: 0x02,
	TEMPERATURE_LOW: 0x03,

	// reserved 0x04 - 0x07
	MODEL_HIGH: 0x08,
	MODEL_LOW: 0x09,
	VERSION: 0x0A,
	DEVICE_ID: 0x0B,
	// C,D and E also device id

	STATUS: 0x0F,

	USER_1_HIGH: 0x10,
	USER_1_LOW: 0x11,
	USER_2_HIGH: 0x12,
	USER_2_LOW: 0x13
}

export const BULK_FIRST_REGISTER = 0x00
export const BULK_DATA_BYTE_SIZE = 4

export const INFO_FIRST_REGISTER = 0x08
export const INFO_BYTE_SIZE = 7

export const WORD_SIZE = 2
