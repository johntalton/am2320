# Aosong / Asair AM2320

A simple I²C Temperature and Humidity Sensor.

As always, [Adafruit](https://www.adafruit.com/product/3721) is a good place to start.

## Mode Selection

The AM2320 support two distinct modes of operation interface. Classic 1-Wire interface, which seems to be the common / preferred method of interaction, and a `Modbus` interface over I²C.

This library specificly focuses on the I²C interface.

#### Selecting Mode

The AM2320 will select the operational mode (1-Wire vs I²C) on power-on.  This is achived by forcing the initial state of the Clock (SCL or pin 4) line `LOW` or `HIGH` during the power up phase.

The easiest way to achive this is by adding pull-up resistors (to select I²C) to the SCL / SDA lines.  While boards like the Raspberry Pi have existing pull-up resistors they may not be sutable for this particular chip.

## I²C interface

#### Wake

To save power and to provide more accurate readings (by not heating up the chip) the AM2320 goes into a deep-sleep.  So much so that the I²C interface is put to sleep (which is why many forum post are titled 'not working').

This auto-sleep requires a `wake` command to be sent on the bus prior to interacting with the standard interface.  Once woken the chip will responde to I²C commands, however, there is a limited access window to execute command before the chip will return to the sleep state.  

While not documented, trying to use a write command more than once per wake period seem to produce failures.


#### Model / Version / ID

For the most part, these are Zeroed on this chip. However, the methods for reading via this library are provided.  

Note: documentation on this or defacto examples would be desirable here (please use issues to report, thanks)

#### Status

Like the above, the status register is (mostly) unused.  Though some undocumented interaction seems to exist (needs investigation)

#### User 1 / 2

The chip provides two 16bit User registers.  These register are Read/Write, and interface for them is provided by this library.

It is of note that these two registers seem to persist accross power cycles; making them usefull to hold identifing information and/or calibration configuration etc.

#### Temperature / Humidity

Temperature and Humidity can be accessed individually or in Bulk (both temperature and humidity in single call).

The values are returned in Celcius / Farenheit (for Temperature) and Percent Relative Humidity (%RH), making interaction easy and flexible

## Modbus

The `Modbus` protocol includes a `crc16` checksum on each read / write.  This adds a layer of validation to the interactions and a level of confidence in the chips (and this libraries) operation.

Many implemetation bypass the checksum (on both read and write), which provides some interfaction speed, but reduces confidence.  

To this end, this library will provide a unsafe-fast-mode that reduces the `crc16` calls on read.


