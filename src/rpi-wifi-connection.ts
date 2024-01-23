import util from 'util';
import { exec } from "child_process"

export default class RpiWiFiConnection {
    private network_interface: string
    constructor(network_interface: string = "wlan0") {
        this.network_interface = network_interface
    }

    /**
     * Returns singleton list of SSIDs or empty list if not connected.
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
     * Returns a list of SSIDs or empty list if not connected.
    */
    scan_networks = async () => {
        let scanned: string[] = []
    
        await util.promisify(exec)("wpa_cli -i wlan0 scan_results")
        .then((result: {stdout: string, stderr: string}) => {
            if (result.stderr) {
                console.log("Wi-Fi scan error: " + result.stderr)
            } else {
                let raw_list = result.stdout.split(/\r?\n/)
                raw_list.shift()
                let ssids = new Set<string>()
                raw_list.forEach((line) => {
                    const attribs = line.split('\t')
                    // In a normal output, there are 5 fields:
                    // bssid, frequency, signal level, flags, and ssid
                    if (attribs.length == 5) {
                        ssids.add(attribs[4])
                    }
                })
                scanned = Array.from(ssids)
            }
        })
        .catch((error) => {
            console.log("Wi-Fi scan error: " + error)
        })
    
        return scanned
    }

    // TODO: Connect to a network.
}