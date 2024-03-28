import crc16modbus from 'crc/crc16modbus'

import { CRC_BYTE_SIZE, ERROR_RESPONSE_BYTE_SIZE } from './ammodbusdefs.js'

/**
 *
 **/
export class Common {
	/**
	 * @param buffer Incoming bytes to parse as response.
	 * @param command Reference command byte to validate against.
	 * @param check Enable or Disable CRC checks for this buffer.
	 **/
	static parseResponse(buffer, command, check) {
		// console.log('\tbuffer', buffer);
		return Common.parseCmdCrc(buffer, command, check)
	}

	/**
	 * @param buffer Incoming bytes to parse as error.
	 * @param command Reference command byte to validate against.
	 * @param check Enable or Disable CRC checks for this buffer.
	 * @returns Error code specific to implementation.
	 **/
	static parseError(buffer, command, check) {
		if(buffer.length !== ERROR_RESPONSE_BYTE_SIZE) { throw new Error('error buffer length invalid') }
		const outbuf = Common.parseCmdCrc(buffer, command, check)
		// the out buffer should be two bytes, a base offset
		//   top level error code (loosely defined by modbus)
		// another byte which is likely proprietary to the calling
		//   structure (in the case of a write, it may be the
		//   address, or a read the length of the overall error
		//   buffer size, which is not the same concept of size
		//   shared by read in general)
		// thus inspect the code byte
		// note that the order seem backwards here. this may
		//   have to do with the intended 16bit nature of modbus
		//   and thus a 16bit read here, and then a split of
		//   the bytes may be useful
		const code = outbuf.readUInt8(1)
		return code
	}

	/**
	 * @param buffer Incoming bytes to parse command and crc structures.
	 * @param command Reference command byte to validate against.
	 * @param check Enable or Disable CRC checks for this buffer.
	 * @returns Buffer containing data segment of incoming buffer.
	 **/
	static parseCmdCrc(buffer, command, check) {
		// console.log('Command CRC',buffer)
		const cmd = buffer.readUInt8(0)
		if(cmd !== command) { throw new Error('command mismatch') }

		if(check === false) { return buffer.slice(1) }

		// assuming buffer is correct size, crc is at the end
		const csum = buffer.readUInt16LE(buffer.length - CRC_BYTE_SIZE)

		// calculate our own crc (all data except the crc, duh)
		const data = buffer.slice(0, buffer.length - CRC_BYTE_SIZE)
		const actual = crc16modbus(data)
		// console.log('actual CRC', actual)
		if(csum !== actual) { throw new Error('crc mismatch') }
		if(csum === 0 || actual === 0) { throw new Error('crc or actual zero') }

		return buffer.slice(1, -CRC_BYTE_SIZE)
	}

}
