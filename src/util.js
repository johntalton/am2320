/* eslint no-bitwise: ["error", { "allow": ["&", ">>"] }] */

const EIGHT_BIT_MASK = 0xFF;
const EIGHT_BIT_SHIFT = 8;

const DEFAULT_ZERO_VALUE = 0;

/**
 * Util to wrap bitwise helpers.
 **/
class Util {
  /**
   * @param value A 16-bit value to be split.
   * @returns An object with `high` and `low` property
   *  assigned from splitting the 16-bit `value` into two 8-bits.
   **/
  static split16(value) {
    const high = (value >> EIGHT_BIT_SHIFT) & EIGHT_BIT_MASK;
    const low = value & EIGHT_BIT_SHIFT;
    return { high, low };
  }

  /**
   * @param buffer Incoming buffer to be validated.
   * @param zeroValue Byte value to test buffer against.
   * @returns True if `buffer` values contain all `zeroValue`.
   **/
  static validateZeroFill(buffer, zeroValue = DEFAULT_ZERO_VALUE) {
    const ary = [...buffer]; // todo magic buffer to array trick
    return ary.reduce((acc, item) => acc && (item === zeroValue), true);
  }

  /**
   * @param value A 16-bit device encoded value.
   * @returns Decoded positive or negative magnitude.
   **/
  static convertFromValue(value) { // todo, move to bit utilities
    const isNeg = ((value >> 15) & 0x1) === 0x1;
    const magnitude = value & 0x7FFF;
    if(isNeg) { return -magnitude; }
    return magnitude;
  }

  /**
   * @param value A 16-bit device encoded value.
   * @returns A object with `C` and `F` properties.
   **/
  static convertFromTemperature(value) {
    const tempC = Util.convertFromValue(value) / 10.0;
    const tempF = (tempC * (9 / 5.0)) + 32; // todo we have other sensor that use this
    return {
      C: tempC,
      F: tempF
    };
  }

  /**
   * @param value A 16-bit device value.
   * @returns An object with `percent` in RH.
   **/
  static convertFromHumidity(value) {
    const percentRH = value / 10.0;
    return { percent: percentRH };
  }
}

module.exports = { Util };
