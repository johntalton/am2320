const { Rasbus } = require('@johntalton/rasbus');
const { Am2320, DEFAULT_ADDRESS } = require('../');

const i2cbusid = 1;

Rasbus.i2c.init(i2cbusid, DEFAULT_ADDRESS)
  .then(bus => Am2320.from(bus))
  .then(device => {
    console.log('Aosong AM2320 up');
    //
    return device.wake()
      // .then(() => device.model()).then(model => console.log('model', model))
      // .then(() => device.version()).then(version => console.log('version', version))
      // .then(() => device.id()).then(id => console.log('id', id))

      // .then(() => device.temperature()).then(temp => console.log('temperature (C)', temp))
      // .then(() => device.humidity()).then(hum => console.log('humidity (%RH)', hum))

      // .then(() => device.wake())

      // .then(() => device.status()).then(status => console.log('status', status))
      // .then(() => device.setStatus(42))
      // .then(() => device.status()).then(status => console.log('status', status))

      .then(() => device.user1()).then(user1 => device.setUser1(user1 + 1))
      .then(() => device.user1()).then(user1 => console.log('user1', user1))

      // .then(() => Promise.all([device.temperature(), device.humidity()]))
      .then(() => device.bulk())
      .then(bulk => console.log('temperature (F)', bulk.temperature.F, 'humidity (%RH)', bulk.humidity.percent));
  })
  .catch(e => console.log('top level error', e));
