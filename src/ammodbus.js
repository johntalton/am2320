import { Buffer } from 'node:buffer'
import crc16modbus from 'crc/crc16modbus'

import { Common } from './common.js'
import { Util } from './util.js'
import {
	ErrorUtil,
	FUNCTION,
	ERROR_MASK,
	WRITE_RESPONSE_RAW_BYTE_SIZE,
	WRITE_RESPONSE_BYTE_SIZE,
	READ_RESPONSE_RAW_BYTE_SIZE_BASE,
	READ_RESPONSE_BYTE_SIZE_BASE,
	ERROR_RESPONSE_BYTE_SIZE
} from './ammodbusdefs.js'

// todo debug blob for now
const perf = {
	commandCount: 0,
	hasWriten: false,
	wakeMSecs: Math.INFINITY,
	lastcall: Math.INFINITY
}

/**
 *
 **/
export class AmModbus {
	static wake(bus) {
		// console.log('wake')
		perf.commandCount = 0
		perf.hasWriten = false
		perf.wakeMSecs = Date.now()
		perf.lastcall = Math.INFINITY

		// what is the best way to send the wake?
		// return bus.write(0x00, [])
		// return bus.read(0x00, 0)
		return bus.read(0x00, 1)
			// return bus.readBuffer(1)
			.then(() => false).catch(() => true)
	}

	static read(bus, register, length, check) {
		const command = FUNCTION.READ
		const readsizebase = check ? READ_RESPONSE_BYTE_SIZE_BASE : READ_RESPONSE_RAW_BYTE_SIZE_BASE
		const responsesize = readsizebase + length

		const start = Date.now()
		// if(perf.lastcall === Math.INFINITY) { console.log(' - first') }
		// console.log(' - last call delta', start - perf.lastcall)
		perf.lastcall = start
		// const delta = perf.lastcall - perf.wakeMSecs
		// console.log(' - delta from wake', delta)

		// console.log('\tread', register, length)
		//
		return bus.write(command, [register, length])
			// .then(() => waitMSecs(2)) // todo spec notes but js is slow, no need :)
			.then(() => bus.readBuffer(responsesize))
			.then(buffer => {
				perf.lastwrite = Date.now()
				return buffer
			})
			.then(buffer => {
				// handle modbus.read return structure
				// the resulting length should match the desired read length
				// it is of note that we have not parsed the packet at
				//   this point, but we can assume if these do not match
				//   something is wrong, and trigger error packet parsing
				const len = buffer.readUInt8(1)
				if(len !== length) {
					// console.log('length vs expected', len, length, buffer)
					// parse as error
					// todo check sliced out tail to validate all Zeros
					if(!Util.validateZeroFill(buffer.slice(ERROR_RESPONSE_BYTE_SIZE))) {
						// console.log(' * trailing zeros not, may not be error')
					}

					const code = Common.parseError(buffer.slice(0, ERROR_RESPONSE_BYTE_SIZE), command, check)
					throw new Error(ErrorUtil.errorForCode(code))
				}

				return Common.parseResponse(buffer, command, check)
			})
			.then(buffer => {
				const len = buffer.readInt8(0)
				if((len + 1) !== buffer.length) { throw new Error('length mismatch') }
				// length is ok, slice it out and return
				return buffer.slice(1)
			})
	}

	static write(bus, register, buf, check) {
		const command = FUNCTION.WRITE
		const bufferLength = buf.length
		const ary = [...buf] // todo buffer to array trick

		const data = [register, bufferLength].concat(ary)
		const checksum = crc16modbus([command].concat(data))
		// split into high/low bytes
		// todo consider Util class split
		const low = checksum & 0xFF
		const high = (checksum >> 8) & 0xFF

		const responsesize = check ? WRITE_RESPONSE_BYTE_SIZE : WRITE_RESPONSE_RAW_BYTE_SIZE

		// class tracking written state
		if(perf.hasWriten) {
			// console.log('write has been called this wake, likely failure')
		}
		perf.hasWriten = true

		// create buffer to write
		const cmdbuf = Buffer.from([command].concat(data).concat([low, high]))
		return bus.writeBuffer(cmdbuf)

			// todo wait 2ms, or just let js be slow
			.then(() => bus.readBuffer(responsesize))
			.then(buffer => {
				// handle modbus.write return structure
				const len = buffer.readUInt8(2)
				if((len & ERROR_MASK) === ERROR_MASK) {
					if(!Util.validateZeroFill(buffer.slice(ERROR_RESPONSE_BYTE_SIZE))) {
						// console.log(' * trailing zeros not, may not be error')
						// console.log(buffer) // todo debug
					}

					const code = Common.parseError(buffer.slice(0, ERROR_RESPONSE_BYTE_SIZE), command, check)
					throw new Error(ErrorUtil.errorForCode(code))
				}

				return Common.parseResponse(buffer, command, check)
			})
			.then(buffer => {
				const addr = buffer.readUInt8(0)
				if(addr !== register) { throw new Error('register mismatch') }

				const len = buffer.readUInt8(1)
				if(len !== bufferLength) { throw new Error('write error, length mismatch') }

				return true
			})
	}
}
