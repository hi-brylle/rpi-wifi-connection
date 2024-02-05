import util from 'util';
import { exec } from "child_process"

export interface WiFiNetwork {
    bssid: string,
    frequency: number,
    signal_level: number,
    ssid: string
}

interface ConfiguredNetwork {
    id: number,
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

    /**
     * Attempt connection to network.
     * Use 'get_status' again to check whether connection succeeded or not.
    */
    connect_to_network = async (ssid: string, password: string) => {
        // Connecting to the network requires some ceremony.
        // The /etc/wpa_supplicant/wpa_supplicant.conf needs to be edited to
        // contain a block of text containing our selected SSID and its input password.
        // After this, a reconfigure command is used.
        // In order for the wpa_supplicant to choose the network we inputted, we first
        // remove all existing networks in the wpa_supplicant.conf file.

        const get_existing_networks = async () => {
            return util.promisify(exec)(`wpa_cli -i ${this.network_interface} list_networks`)
            .then((result: {stdout: string, stderr: string}) => {
                if (result.stderr) {
                    throw new Error("Wi-Fi network list error: " + result.stderr)
                } else {
                    let network_ids: ConfiguredNetwork[] = []
                    let raw_list = result.stdout.split(/\r?\n/)
                    raw_list.shift() // Remove the header.
                    raw_list.forEach((line) => {
                        if (line.length > 0) {
                            const attribs = line.split('\t')
                            network_ids.push({
                                id: parseInt(attribs[0]),
                                ssid: attribs[1]
                            })
                        }
                    })
                    return network_ids
                }
            })
        }

        const remove_existing_network = async (network_id: number) => {
            await util.promisify(exec)(`wpa_cli -i ${this.network_interface} remove_network ${network_id}`)
        }

        const add_new_network = async () => {
            util.promisify(exec)(`wpa_cli -i ${this.network_interface} add_network`)
            .then((result: {stdout: string, stderr: string}) => {
                if (result.stderr) {
                    throw new Error("Wi-Fi add network error: " + result.stderr)
                } else {
                    return parseInt(result.stdout) 
                }
            })
            .then(async (new_network_id: number) => {
                await util.promisify(exec)(`wpa_cli -i ${this.network_interface} set_network ${new_network_id} ssid '"${ssid}"'`)
                return new_network_id
            })
            .then(async (new_network_id: number) => {
                await util.promisify(exec)(`wpa_cli -i ${this.network_interface} set_network ${new_network_id} psk '"${password}"'`)
                return new_network_id
            })
            .then(async (new_network_id: number) => {
                await util.promisify(exec)(`wpa_cli -i ${this.network_interface} enable_network ${new_network_id}`)
                return new_network_id
            })
            .then(async (new_network_id: number) => {
                await util.promisify(exec)(`wpa_cli -i ${this.network_interface} select_network ${new_network_id}`)
            })
            .then(async () => {
                await util.promisify(exec)(`wpa_cli -i ${this.network_interface} save_config`)
            })
        }

        const reconfigure = async () => {
            await util.promisify(exec)(`wpa_cli -i ${this.network_interface} reconfigure`)
        }

        await get_existing_networks()
        .then((configured_networks: ConfiguredNetwork[]) => {
            configured_networks
                .filter(network => network.ssid == ssid)
                .forEach((network) => {
                    remove_existing_network(network.id)
                })
        })
        .then(add_new_network)
        .then(reconfigure)
        .catch((error: any) => {
            console.log("Wi-Fi connection error: " + error)
            reconfigure()
        })
    }
}