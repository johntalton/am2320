
class Util {
  static split16(value) {
    const high = (value >> 8) & 0xFF;
    const low = value & 0xFF;
    return { high, low };
  }

  static validateZeroFill(buffer) {
    const ary = [...buffer]; // todo magic buffer to array trick
    return ary.reduce((acc, item) => acc & (item === 0), true);
  }
}

module.exports = { Util };
