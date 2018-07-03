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
  // if(true) { return waitMSecs(WAKE_WAIT_MSECS_RANGE[0]); }
  // todo what other type of feature for the valid rage can be add here?
  const avg = (range[0] + range[1]) / 2; // todo .first .last
  return waitMSecs(avg);
}

function Promise_serial(list) {
  return list.reduce((acc, item) => {
    return acc.then(() => item());
  }, Promise.resolve());
}

Rasbus.i2c.init(i2cbusid, DEFAULT_ADDRESS)
  .then(bus => Am2320.from(bus))
  .then(device => {
    console.log('Aosong AM2320 up');
    //
    return device.wake()
      .then(woke => {
        console.log('wake', woke);
        return waitRangeMSecs(WAKE_WAIT_MSECS_RANGE)
      })

      // woke false, indicating the bus was already valid
      //  but are limited time window as no reference time of last wake
      //.then(() => device.wake()).then(woke => console.log('rewoke', woke))


//    from README
//    .then(() => device.info().then(console.log))
//    .then(() => device.status().then(console.log))
//    .then(() => device.user().then(console.log))
//    .then(() => device.bulk().then(console.log))


      // .then(() => waitMSecs(300)) // todo, spec notes but works without as js is slow

      // .then(() => device.model()).then(model => console.log('model', model))
      // .then(() => device.version()).then(version => console.log('version', version))
      // .then(() => device.id()).then(id => console.log('id', id))

      //.then(() => device.info()).then(info => console.log('info', info))

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


      //.then(() => waitMSecs(100))


      //.then(() => device.setStatus(1))
      //.then(() => device.status()).then(status => console.log('status', status))



      // .then(() => waitMSecs(150))

      // inc
      .then(() => device.user1().then(user1 => device.setUser(user1 + 1, 42)))
      //.then(() => device.user1().then(user1 => waitMSecs(151).then(() => device.setUser(user1 + 1, 42))))

      //.then(() => waitMSecs(300))

      .then(() => device.user1()).then(user1 => console.log('user1', user1))

      // .then(() => device.setUser2(69))
     // .then(() => device.user2()).then(user2 => console.log('user2', user2))

      //.then(() => waitMSecs(200))


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


       //.then(() => waitMSecs(200))

      // .then(() => Promise.all([device.temperature(), device.humidity()]))
      //.then(() => device.bulk())
      //.then(bulk => console.log('temperature (F)', bulk.temperature.F, 'humidity (%RH)', bulk.humidity.percent))

      //.then(() => waitMSecs(50))

      .then(() => {
        // note, multiple calls to bulk seem to return single cached value, just demo

        const MAX_I2C_BREAK_RUN = 1000; // todo observation, after about a K the device will start to fail (power reset needed)
        const MAX_BULK_RUN = 120; // todo observation 140 before sleep reset, need timeing track
        // all reads within the window are 'stable' however after about 10 calls there can
        // be a reset, which will be a run of errors, then the values will jump to next.
        // this is also a reset of the wake system.
        const MAX_FIRST_BULK_RUN = 10; // todo observation, after about a dozen calls a reset happens for a half dozen more before entering a new wake state
        // note that the first run number seems to be more unstable, where the next block of max run seem to be a stable value

        // choosing a small range to validate (returns the same value until next wake cycle)
        const range = (new Array(5)).fill(0);
        return  Promise_serial(range.map((value, index) => {
          return () => {
//return device.humidity().then(({ percent }) => console.log('RH %', percent))
            return device.bulk()
            .then(({ temperature, humidity }) =>
              //console.log('bulk log', temperature, humidity))
              console.log('repeat read #', index,  temperature.C, '°C', humidity.percent, 'RH%'))
            .catch(e => console.log('bulk error', e))
            .then(() => waitMSecs(10))

          };
        }));
      })

      .finally(() => console.log('CLOSE'));
  })
  .catch(e => console.log('top level error', e));
