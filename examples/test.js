const { Rasbus } = require('@johntalton/rasbus');
const { Am2320, DEFAULT_ADDRESS } = require('../');

const i2cbusid = 1;

function waitMSecs(msecs) {
  return new Promise((resolve, reject) => {
    console.log('wait', msecs);
    setTimeout(() => resolve(), msecs);
  });
}

// note these ranges have little to do with what is documented and are
//   primarly derived from imperical manual tests
const WAKE_WAIT_MSECS_RANGE = [5, 420]; // trial and error produced 300

function waitRangeMSecs(range) {
  // todo what other type of feature for the valid rage can be add here?
  const avg = (range[0] + range[1]) / 2; // todo .first .last
  return waitMSecs(avg);
}

Rasbus.i2c.init(i2cbusid, DEFAULT_ADDRESS)
  .then(bus => Am2320.from(bus))
  .then(device => {
    console.log('Aosong AM2320 up');
    //
    return device.wake()

      .then(() => waitRangeMSecs(WAKE_WAIT_MSECS_RANGE))
      // .then(() => waitMSecs(300)) // todo, spec notes but works without as js is slow

      // .then(() => device.model()).then(model => console.log('model', model))
      // .then(() => device.version()).then(version => console.log('version', version))
      // .then(() => device.id()).then(id => console.log('id', id))

      .then(() => device.info()).then(info => console.log('info', info))

      // .then(() => device.temperature()).then(temp => console.log('temperature (C)', temp))
      // .then(() => device.humidity()).then(hum => console.log('humidity (%RH)', hum))

      // .then(() => device.wake())

      // .then(() => device.status()).then(status => console.log('status', status))
      // .then(() => device.setStatus(42))
      //.then(() => device.status()).then(status => console.log('status', status))


      // test reading more than ten registers ILLEGAL_ADDRESS
      // .then(() => device.read(0x00, 11))

      // test writing word to status WRITE_DISABLED
      // .then(() => device.write(0x0F, [0, 1]))

      // test read invalid address ILLEGAL_ADDRESS
      // .then(() => device.read(0x20, 1))

      // test write too much WRITE_DATA_SCOPE
      // .then(() => device.write(0x10, [0, 1, 2, 3, 4,5,6,7,8,9,10]))

      // test write to partial ro WRITE_DISABLED
      // .then(() => device.write(0x11, [0, 1, 2,3 ]))


      .then(() => waitMSecs(100))


      //.then(() => device.setStatus(1))
      .then(() => device.status()).then(status => console.log('status', status))

      //.then(() => waitMSecs(50))

      // .then(() => device.setUser2(69))
      .then(() => device.user2()).then(user2 => console.log('user2', user2))

       //.then(() => waitMSecs(150))

      // inc
      .then(() => device.user1()).then(user1 => device.setUser1(user1 + 1))
      .then(() => device.user1()).then(user1 => console.log('user1', user1))


      // .then(() => device.user1()).then(user1 => console.log('user1', user1))
/*      .then(() => device.user1()).then(user1 => console.log('user1', user1))
      .then(() => device.user1()).then(user1 => console.log('user1', user1))
      .then(() => device.user1()).then(user1 => console.log('user1', user1))
      .then(() => device.user1()).then(user1 => console.log('user1', user1))
      .then(() => device.user1()).then(user1 => console.log('user1', user1))
      .then(() => device.user1()).then(user1 => console.log('user1', user1))
      .then(() => device.user1()).then(user1 => console.log('user1', user1))
      .then(() => device.user1()).then(user1 => console.log('user1', user1))
      .then(() => device.user1()).then(user1 => console.log('user1', user1))
      .then(() => device.user1()).then(user1 => console.log('user1', user1))
      .then(() => device.user1()).then(user1 => console.log('user1', user1))
      .then(() => device.user1()).then(user1 => console.log('user1', user1))
      .then(() => device.user1()).then(user1 => console.log('user1', user1))
      .then(() => device.user1()).then(user1 => console.log('user1', user1))
      .then(() => device.user1()).then(user1 => console.log('user1', user1))
*/


      // .then(() => waitMSecs(100))

      // .then(() => Promise.all([device.temperature(), device.humidity()]))
      .then(() => device.bulk())
      .then(bulk => console.log('temperature (F)', bulk.temperature.F, 'humidity (%RH)', bulk.humidity.percent));
  })
  .catch(e => console.log('top level error', e));
