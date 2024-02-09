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

### `ConfiguredNetwork`
Type returned when querying for networks previously connected to.
```ts
interface ConfiguredNetwork {
    id: number,
    ssid: string
}
```


## Methods

### `get_status()`
Returns a singleton list containing the sole SSID if device is connected or empty list if not connected.

### `scan_networks()`
Returns a list of `WifiNetwork` or empty list if nothing is detected.

### `get_configured_networks()`
Returns a list of `ConfiguredNetwork` or empty list if the RPi has never
connected to a Wi-Fi network.

### `connect_to_network(ssid: string, password: string)`
Attempts connection with `ssid` and `password` input. Doesn't return anything. Use `get_status()` to check whether connection attempt succeeded.

### `forget_network(ssid_to_forget: string)`
Remove previously configured network from the RPi to prevent it from auto-connecting to that network in the future.

### `auto_connect_to_network(ssid: string)`
Auto-connect to a previously configured network. If `ssid` input doesn't
belong to the list returned by `get_configured_networks()`, nothing happens. 
Use `get_status()` to check whether connection attempt succeeded.