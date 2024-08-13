import util from 'node:util';
import { exec } from "child_process"

export interface WiFiNetwork {
    bssid: string,
    frequency: number,
    signal_level: number,
    ssid: string
}

export interface ConfiguredNetwork {
    id: number,
    ssid: string
}

export class RpiWiFiConnection {
    private network_interface: string
    constructor(network_interface: string = "wlan0") {
        this.network_interface = network_interface
    }

    /**
     * Returns singleton list of SSID or empty list if not connected.
    */
    get_status = async () => {
        return await util.promisify(exec)(`wpa_cli -i ${this.network_interface} status`)
        .then((result: {stdout: string, stderr: string}) => {
            if (result.stderr) {
                return [] as string[]
            } else {
                let connections: string[] = []
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

                return connections
            }
        })
    }

    /**
     * Returns a list of network information or empty list if not connected.
    */
    scan_networks = async () => {
        return await util.promisify(exec)(`wpa_cli -i ${this.network_interface} scan_results`)
        .then((result: {stdout: string, stderr: string}) => {
            if (result.stderr) {
                return [] as WiFiNetwork[]
            } else {
                let scanned: WiFiNetwork[] = []
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

                return scanned
            }
        })
    }

    /**
     * Returns a list of network information of previously configured networks.
     * Returns empty list if not connected.
    */
    get_configured_networks = async () => {
        return await util.promisify(exec)(`wpa_cli -i ${this.network_interface} list_networks`)
        .then((result: {stdout: string, stderr: string}) => {
            if (result.stderr) {
                return [] as ConfiguredNetwork[]
            } else {
                let configured_networks: ConfiguredNetwork[] = []
                let raw_list = result.stdout.split(/\r?\n/)
                raw_list.shift() // Remove the header.
                raw_list.forEach((line) => {
                    if (line.length > 0) {
                        const attribs = line.split('\t')
                        configured_networks.push({
                            id: parseInt(attribs[0]),
                            ssid: attribs[1]
                        })
                    }
                })

                return configured_networks
            }
        })
    }

    /**
     * Attempt connection to network.
     * Use 'get_status' again to check whether connection succeeded or not.
    */
    connect_to_network = async (ssid: string, password: string) => {
        // Connecting to the network requires some ceremony.
        // The /etc/wpa_supplicant/wpa_supplicant.conf needs to be edited to
        // contain a block of text containing our selected SSID and its input password.
        // We 'update' the wpa_supplicant.conf by removing any possibly outdated information
        // on our selected SSID and then immediately adding it again.
        // After this, a reconfigure command is used.

        const add_new_network = async () => {
            await util.promisify(exec)(`wpa_cli -i ${this.network_interface} add_network`)
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

        await this.get_configured_networks()
        .then((configured_networks: ConfiguredNetwork[]) => {
            configured_networks
                .filter(n => n.ssid == ssid)
                .forEach((network) => {
                    this.remove_existing_network(network.id)
                })
        })

        await add_new_network()
        .then(reconfigure)
    }

    private remove_existing_network = async (network_id: number) => {
        await util.promisify(exec)(`wpa_cli -i ${this.network_interface} remove_network ${network_id}`)
        .then(() => {
            util.promisify(exec)(`wpa_cli -i ${this.network_interface} save_config`)
        })
    }

    /**
     * Remove a previously configured network.
    */
    forget_network = async (ssid_to_forget: string) => {
        (await this.get_configured_networks())
            .filter((cn) => cn.ssid == ssid_to_forget) // There may be multiple configured networks for the same SSID
            .forEach((network_to_forget) => {
                this.remove_existing_network(network_to_forget.id)
            })
    }

    /**
     * Auto-connect to a previously configured network.
     * Use 'get_status' again to check whether connection succeeded or not.
    */
    auto_connect_to_network = async (ssid: string) => {
        let network_to_connect_to = (await this.get_configured_networks()).find((cn) => cn.ssid == ssid)
        if (network_to_connect_to) {
            await util.promisify(exec)(`wpa_cli -i ${this.network_interface} select_network ${network_to_connect_to.id}`)
        }
    }

    /**
     * Disconnect from Wi-Fi.
    */
    disconnect_from_wifi = async () => {
        await util.promisify(exec)(`wpa_cli -i ${this.network_interface} disconnect`)
    }

    /**
     * Reconnect to Wi-Fi. Effects may not be immediate
     * so call `get_status` to check connection status or
     * call `scan_networks` to query all available networks
     * after some timeout.
    */
    reconnect_to_wifi = async () => {
        await util.promisify(exec)(`wpa_cli -i ${this.network_interface} reconnect`)
    }
}

module.exports = RpiWiFiConnection