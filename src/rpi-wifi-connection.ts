import util from 'util';
import { exec } from "child_process"

export interface WiFiNetwork {
    bssid: string,
    frequency: number,
    signal_level: number,
    ssid: string
}

export default class RpiWiFiConnection {
    private network_interface: string
    constructor(network_interface: string = "wlan0") {
        this.network_interface = network_interface
    }

    /**
     * Returns singleton list of SSID or empty list if not connected.
    */
    get_status = async () => {
        let connections: string[] = []

        await util.promisify(exec)(`wpa_cli -i ${this.network_interface} status`)
        .then((result: {stdout: string, stderr: string}) => {
            if (result.stderr) {
                console.log("Wi-Fi connection status error: " + result.stderr)
            } else {
                let raw_list = result.stdout.split(/\r?\n/)
                let object = {}
                raw_list.forEach((line) => {
                    let kv_array = line.split('=')
                    object = Object.assign(object, {[kv_array[0]]: kv_array[1]})
                })

                if ("wpa_state" in object &&
                    "ssid" in object &&
                    object["wpa_state"] as string == "COMPLETED") {
                    connections.push(object["ssid"] as string)
                }
            }
        })
        .catch((error) => {
            console.log("Wi-Fi connection status error: " + error)
        })

        return connections
    }

    /**
     * Returns a list of network information or empty list if not connected.
    */
    scan_networks = async () => {
        let scanned: WiFiNetwork[] = []
    
        await util.promisify(exec)(`wpa_cli -i ${this.network_interface} scan_results`)
        .then((result: {stdout: string, stderr: string}) => {
            if (result.stderr) {
                console.log("Wi-Fi scan error: " + result.stderr)
            } else {
                let raw_list = result.stdout.split(/\r?\n/)
                raw_list.shift() // Remove the header.
                raw_list.forEach((line) => {
                    const attribs = line.split('\t')
                    // In a normal output, there are 5 fields:
                    // bssid, frequency, signal level, flags, and ssid.
                    // We skip the flags.
                    scanned.push({
                        bssid: attribs[0],
                        frequency: parseInt(attribs[1]),
                        signal_level: parseInt(attribs[2]),
                        ssid: attribs[4]
                    })
                })
            }
        })
        .catch((error) => {
            console.log("Wi-Fi scan error: " + error)
        })
    
        return scanned
    }

    // TODO: Connect to a network.
}