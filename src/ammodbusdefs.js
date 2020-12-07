
// Modbus
const FUNCTION = { READ: 0x03, WRITE: 0x10 };

// modbus format sizes
const CRC_BYTE_SIZE = 2;
const COMMAND_BYTE_SIZE = 1;

// write response
const WRITE_RESPONSE_HEADER_ADD_BYTE_SIZE = 1;
const WRITE_RESPONSE_HEADER_LEN_BYTE_SIZE = 1;
const WRITE_RESPONSE_HEADER_BYTE_SIZE =
  COMMAND_BYTE_SIZE +
  WRITE_RESPONSE_HEADER_ADD_BYTE_SIZE +
  WRITE_RESPONSE_HEADER_LEN_BYTE_SIZE;
const WRITE_RESPONSE_RAW_BYTE_SIZE = WRITE_RESPONSE_HEADER_BYTE_SIZE;
const WRITE_RESPONSE_BYTE_SIZE = WRITE_RESPONSE_RAW_BYTE_SIZE + CRC_BYTE_SIZE;

// read response
const READ_RESPONSE_HEADER_LEN_BYTE_SIZE = 1;
const READ_RESPONSE_HEADER_BYTE_SIZE =
  COMMAND_BYTE_SIZE +
  READ_RESPONSE_HEADER_LEN_BYTE_SIZE;
const READ_RESPONSE_RAW_BYTE_SIZE_BASE = READ_RESPONSE_HEADER_BYTE_SIZE;
const READ_RESPONSE_BYTE_SIZE_BASE = READ_RESPONSE_RAW_BYTE_SIZE_BASE + CRC_BYTE_SIZE;

// error response
const ERROR_RESPONSE_HEADER_FOO_BYTE_SIZE = 1;
const ERROR_RESPONSE_HEADER_CODE_BYTE_SIZE = 1;
const ERROR_RESPONSE_BODY_BYTE_SIZE =
  ERROR_RESPONSE_HEADER_FOO_BYTE_SIZE +
  ERROR_RESPONSE_HEADER_CODE_BYTE_SIZE;
const ERROR_RESPONSE_HEADER_BYTE_SIZE =
  COMMAND_BYTE_SIZE +
  ERROR_RESPONSE_BODY_BYTE_SIZE;
const ERROR_RESPONSE_RAW_BYTE_SIZE = ERROR_RESPONSE_HEADER_BYTE_SIZE;
const ERROR_RESPONSE_BYTE_SIZE = ERROR_RESPONSE_RAW_BYTE_SIZE + CRC_BYTE_SIZE;

// error base and value map
const ERROR_BASE = 0x80;
const ERROR_MASK = 0x80;

// device specific listing of standard error values
const ERRORS = [
  // noted in specification
  { msg: 'NOT_SUPPORTED', key: ERROR_BASE },
  { msg: 'ILLEGAL_ADDRESS', key: ERROR_BASE + 1 }, // read length over MAX // out of range // ILLEGAL FUNCTION
  { msg: 'WRITE_DATA_SCOPE', key: ERROR_BASE + 2 }, // write over MAX // ILLEGAL DATA ADDRESS
  { msg: 'CRC_ERROR', key: ERROR_BASE + 3 }, // bad crc on write // ILLEGAL DATA VALUE
  { msg: 'WRITE_DISABLED', key: ERROR_BASE + 4 }, // write 16 to 8bit register // SLAVE DEVICE FAILURE

  // from modbus specification
  { msg: 'SERVER DEVICE BUSY', key: ERROR_BASE + 6 } // write to ro register
];

class ErrorUtil {
  static errorForCode(code) {
    const err = ERRORS.filter(item => item.key === code)
      .map(item => Error('ModBus error message: ' + item.msg))
      .find(() => true); // cheep way to safely get first item, even if not exist

    if(err) { return err; }
    return Error('unknown code: 0x' + code.toString(16));
  }
}


module.exports = {
  ErrorUtil,
  ERROR_MASK,
  CRC_BYTE_SIZE,
  FUNCTION,

  WRITE_RESPONSE_RAW_BYTE_SIZE,
  WRITE_RESPONSE_BYTE_SIZE,
  READ_RESPONSE_RAW_BYTE_SIZE_BASE,
  READ_RESPONSE_BYTE_SIZE_BASE,
  ERROR_RESPONSE_RAW_BYTE_SIZE,
  ERROR_RESPONSE_BYTE_SIZE
};
