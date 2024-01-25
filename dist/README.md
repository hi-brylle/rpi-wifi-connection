# rpi-wifi-connection

A wrapper library that uses [wpa_cli](https://linux.die.net/man/8/wpa_cli) for connecting a Raspberry Pi to Wi-Fi.

## Installation

```sh
$ npm i @hi-brylle/rpi-wifi-connection
```

## Initialization

```ts
import RpiWiFiConnection from '@hi-brylle/rpi-wifi-connection';
let wifi = new RpiWiFiConnection() // "wlan0" default network interface
```

## Types

### `WifiNetwork`
Type returned when scanning for available networks.
```ts
interface WiFiNetwork {
    bssid: string,
    frequency: number,
    signal_level: number,
    ssid: string
}
```


## Methods

### `get_status()`
Returns a singleton list containing the sole SSID if device is connected or empty list if not connected.

### `scan_networks()`
Returns a list of `WifiNetwork` or empty list if nothing is detected.

### `connect_to_network(ssid: string, password: string)`
Attempts connection with `ssid` and `password` input. Doesn't return anything. Use `get_status()` to check whether connection attempt succeeded.