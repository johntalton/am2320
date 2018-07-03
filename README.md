# Aosong / Asair AM2320

A more complete interface for a simple I²C Temperature and Humidity Sensor.

Including:
 - access to humidity and temperature as well as status, and info
 - access to two 16-bit writable user registers
 - full read / write api
 - single register and bulk access
 - full `Promise` / `async` interface
 - enable or disable crc (for speed?)
 - more complet Modbus error reporting

As always, [Adafruit](https://www.adafruit.com/product/3721) is a good place to start.

![4-pin sensor](https://cdn-learn.adafruit.com/assets/assets/000/051/623/large1024/adafruit_products_pinout.jpg)

## Mode Selection

The AM2320 support two distinct modes of operation interface. Classic 1-Wire interface, which seems to be the common / preferred method of interaction, and a `Modbus` interface over I²C.

This library specificly focuses on the I²C interface.

#### Selecting Mode

The AM2320 will select the operational mode (1-Wire vs I²C) on power-on.  This is achived by forcing the initial state of the Clock (SCL or pin 4) line `LOW` or `HIGH` during the power up phase.

The easiest way to achive this is by adding pull-up resistors (to select I²C) to the SCL / SDA lines.  While boards like the Raspberry Pi have existing pull-up resistors they may not be sutable for this particular chip.

## API

#### :blue_book: Class Am2320
:page_facing_up: `static from(bus)`

Current usage of `rasbus` abstract for I²C interface

```javascript
const { Rasbus } = require('@johntalton/rasbus');
const { Am2320, DEFAULT_ADDRESS } = require('@johntalton/am2320');
const I2C_DEVICE_ID = 1;

Rasbus.i2c.init(I2C_DEVICE_ID , DEFAULT_ADDRESS)
  .then(bus => Am2320.from(bus))
  .then(device => {
    // wake sleep and interact - before time is up
    // catch errors liberally within
  })
  .catch(err => console.log('setup error', err));
```

:page_facing_up: [`wake()`](#wake)

:page_facing_up: [`info()`](#model--version--id) ([`model()`](#model--version--id), [`version()`](#model--version--id), [`id()`](#model--version--id))

:page_facing_up: [`status()`](#status), [`setStatus(status)`](#status)

:page_facing_up: [`user()`](#user), [`setUser(one, two)`](#user) ([`user1()`](#user), [`setUser1(value)`](#user), [`user1()`](#user), [`setUser1(value)`](#user))

:page_facing_up: [`bulk()`](#temperature--humidity) ([`humidity()`](#temperature--humidity), [`temperature()`](#temperature--humidity))

:page_facing_up: [`read(register, length)`](#read--write)

:page_facing_up: [`write(register, buffer)`](#read--write)

## I²C interface

TLDR:  As noted in the bellow sections the chip is, fickle at times. 

#### Wake

To save power and to provide more accurate readings (by not heating up the chip) the AM2320 goes into a deep-sleep.  So much so that the I²C interface is put to sleep (which is why many forum post are titled 'not working').

This auto-sleep requires a `wake` method call prior to interacting with the standard interface.  Once woken the chip will responde to I²C commands, however, there is a limited access window to execute command before the chip will return to the sleep state. 

While `wake` is titled as such from the perspective of the api, the bus level call is just a read (specific type, see bellow), and all failures are suppressed (as expected on first wake). The result of this is that "waking" the chip is not a garantee of successfull wake, or that the chip was not already woken (and thus effecting the remaining time for command execution).

While not documented, trying to use a write command more than once per wake period seem to produce failures.

Multiple reads from `bulk` `temperature` or `humidity` will return cached values from captured value at wake.

As example, calling all the bulk access methods for this chip.
```javascript
  return device.wake()
    // sleep
    .then(() => device.info().then(console.log))
    .then(() => device.status().then(console.log))
    .then(() => device.user().then(console.log))
    .then(() => device.bulk().then(console.log))
    
```

:warning: Sleep after wake is recommended. Anywhere from 5 to 400 ms has been observed to work. Many standard `Promise` timeout implementations exist, and a `setTimeout` wrapper works well.

(note that while some timings work with *no* wait; others result usefull success ratio, but most fail without a minimum delay. While at the high end, the risk of allowing the chip to return to sleep state incresses).


#### Model / Version / ID

Reads the `model` `version` and 32-bit chip `id`. Or in a single call to `info`

#### Status

Like the above, the status register is (mostly) unused.  Though some undocumented interaction seems to exist (needs investigation)

#### User

Two 16-bit registers `user1` and `user2` are both read / write.  Access in pair is provided.

As an example:
```javascript
  return device.wake()
    .then(() => device.temperature().then(({ C }) => device.setUser1(C)))
```

It is of note that these two registers seem to persist accross power cycles.

#### Temperature / Humidity

Temperature and Humidity can be accessed individually or in Bulk (both temperature and humidity in single call).

The values are returned in Celcius / Farenheit (for Temperature) and Percent Relative Humidity (%RH), making interaction easy and flexible

```javascript
  return device.wake()
    .then(() => device.bulk())
    .then(({ temperature, humidity }) => console.log('results:', temperature.C, '°C', humidity.percent, 'RH%'))
```

#### Read / Write

Both the `read` and `write` register methods are exposed. Any use cases that bypass the above api should be filled as an issue.

## Modbus

The `Modbus` protocol includes a `crc16` checksum on each read / write.  This adds a layer of validation to the interactions and a level of confidence in the chips (and this libraries) operation.

Many implemetation bypass the checksum (on both read and write), which provides some interfaction speed, but reduces confidence.  

To this end, this library will provide a unsafe-fast-mode that reduces the `crc16` calls on read.


## Architecture limitation

While this api provides the promise interface, it suffers from lacking of mechanism to prevent / detect errors from concurrent access.  Thus `Promise.all()` calls to any of the above api calls would likely fail, as each one require multiple underlining I²C `write` and `read` operations.

The Modbus api provides for decoupling the implementation such that each payload send / response has some level of handshake. Though this complexity seems overkill and exclusive access to the bus is left for the caller in this case.


The implementation is also tied to the underlining bus system and it behaviors.


Notably if the chip is queried improperly (to fast, not fast enough, for to long, etc) the it may go into a hard fail state. This state requires power cycle to bring the interface back online (no current combination of read/writes seem to effect its state).


Further, the bus layer returns similar error code making error prone to try and evaluate them at this level.  

Other limitation of using the `/dev/i2c-1 ` interface (via `i2c-bus`) present many timing error that could otherwize be mitigated as general exceptions to the bus layer.


As noted in reference to `wake`, the timing is left much to the caller.  However, the noted nature of the transaction make this timing prone to external factors, and thus a wider range of enviroment testing is needed.


A note should be made of the delicate intermix of I²C `write` `readBuffer` (in `read`) and `writeBuffer` `readBuffer` (in `write`) as well as the use of `read` in the `wake` command.  The use of the SMBus command set, and the lack of consistency indicate poor understanding of chips operation. 

## Failure profiles

### Codes

While high level api calls (such as `info`, `bulk`, `humidity` etc) are the intended public interface, the Modbus `read` / `write` are also exposed.

And while the high level api should not produce these errors, they can still be exposed when parsing unexpected / invalid bus data as a result of malformed or corrupted interaction. 


Some standard rules form the datasheet:

- Reading more then allowed (ten registers / bytes)
```javascript
  return device.wake()
    .then(() => device.read(0x00, 11))
Error: ModBus error message: ILLEGAL_ADDRESS
```

- Write to the `status` register (a single byte register), and attempt to write to `user1` 16-bit register.  While both (all three) are writable registers, the `status` register is explicitly to be wrien alone (Further enforcing the usfullness of the `setStatus` method).
```javascript
  return device.wake()
    .then(() => device.write(0x0F, [0b00000001, 0x00, 0x25]))
Error: ModBus error message: WRITE_DISABLED
```

- The last address is `0x1F` (Retention :smile:). Read from the vally beyond
```javascript
  return device.wake()
    .then(() => device.read(0x2A, 1))
Error: ModBus error message: WRITE_DATA_SCOPE
```

- Write more then allowed (ten registers / bytes)
```javascript
  return device.wake()
    .then(() => device.write(REGISTERS.USER_1_HIGH, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
Error: ModBus error message: WRITE_DATA_SCOPE
```

 - Start writing to a register that is writable, but then overlaps with non-writable register. In this case we shif our four byte (or two `user1` and `user2` 16-bit registers) to a higher address value, in this case `USER_1_LOW` (a value bulk write of the user register via the `setUser` method would address from `USER_1_HIGH`).
```javascript
  return device.wake()
    .then(() => device.write(REGISTERS.USER_1_LOW, [0x00, 0x2A, 0x00, 0x25]))
Error: ModBus error message: WRITE_DISABLED
```

### Other
The bus / chip failures seem to be common. while some notes about single write per wake sesion and limiting number of reads and the timing between the have been noted above.  

Other failure cases seems to exist
 - the `wake`/`bulk` poll cycle seems to fall into a toggling success / failure state
 - long runs of calls (1K calls to `bulk` in a row) can knock the chip offline, requiring power cycle
 - all timing error represnet themselves as critical bus failures
 
 
