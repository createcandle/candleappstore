"""Candleappstore adapter for Candle Controller / WebThings Gateway."""

# A future release will no longer show privacy sensitive information via the debug option. 
# For now, during early development, it will be available. Please be considerate of others if you use this in a home situation.


from __future__ import print_function

import os
import sys
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))

import re
import json
import time
import socket
#import asyncio
#import logging
import requests
import threading
#import selectors
import subprocess
from subprocess import call, Popen
#from collections import namedtuple

    
from gateway_addon import Database, Adapter
from .util import *
#from .candleappstore_device import *
#from .candleappstore_notifier import *

try:
    from .candleappstore_api_handler import *
except Exception as ex:
    print("Unable to load CandleappstoreAPIHandler (which is used for UI extention): " + str(ex))


_TIMEOUT = 3

_CONFIG_PATHS = [
    os.path.join(os.path.expanduser('~'), '.webthings', 'config'),
]

if 'WEBTHINGS_HOME' in os.environ:
    _CONFIG_PATHS.insert(0, os.path.join(os.environ['WEBTHINGS_HOME'], 'config'))



class CandleappstoreAdapter(Adapter):
    """Adapter for App Store"""

    def __init__(self, verbose=True):
        """
        Initialize the object.
        
        verbose -- whether or not to enable verbose logging
        """
        #print("Starting Candleappstore addon")
        #print(str( os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib') ))
        self.pairing = False
        self.ready = False
        self.DEBUG = False
        self.DEV = False
        self.addon_name = 'candleappstore'
        self.name = self.__class__.__name__ # CandleappstoreAdapter
        #print("self.name = " + str(self.name))
        Adapter.__init__(self, self.addon_name, self.addon_name, verbose=verbose)

        self.developer = False
        self.running = True
        self.app_store_url = 'https://www.candlesmarthome.com/appstore/'
        
        
        self.boot_path = '/boot'
        if os.path.exists('/boot/firmware'):
            self.boot_path = '/boot/firmware'
        
        self.candle_version = '2.0.0'
        self.candle_mayor_version = 2
        if os.path.isfile(self.boot_path + '/candle_version.txt'):
            fresh_candle_version = str(run_command('cat ' + str(self.boot_path) + '/candle_version.txt')).strip().rstrip()
            if '.' in fresh_candle_version:
                self.candle_version = fresh_candle_version
                self.candle_mayor_version
        
        # Exhibit mode
        self.exhibit_mode = False
        if os.path.isfile(self.boot_path + '/exhibit_mode.txt'):
            self.exhibit_mode = True
        
        self.last_get_apps_update_timestamp = 0
        self.busy_installing_addon = None
        self.installing_addons_queue = {}
        self.busy_installing_addon_from_url = False
        self.pre_release_addons = {} # Keeps track of which addons were upgraded to a pre-release version during this session.
        # TODO: store this is persistent data, and then compare versions in the UI
        
        # Uninstall
        self.keep_data_on_uninstall = False

        self.addon_defaults = {} # addon defaults are not available via window.API, so have to scrape addon settings defaults manually from the manifest files
        self.addon_sizes = {} # holds how big the addon directories are
        self.installed_addons = [] # simple directory names list of installed addons (including broken ones)
        self.total_addons_size = None # will hold the total disk size of all the addons

        # Disk space
        self.user_partition_free_disk_space = None
        
        self.device_sd_card_size = None
        if os.path.exists('/dev/mmcblk0'):
            #self.device_sd_card_size = int(run_command("sudo blockdev --getsize64 /dev/mmcblk0"))
            self.device_sd_card_size = int(run_command("lsblk -b --output SIZE -n -d /dev/mmcblk0"))
        
        
        # Total memory
        self.total_memory = None
        try:
            total_memory = run_command("awk '/^MemTotal:/{print $2}' /proc/meminfo | tr -d '\n'")
            self.total_memory = int( int(''.join(filter(str.isdigit, total_memory))) / 1000)
        except Exception as ex:
            print("Error: could not get total installed memory: " + str(ex))
        
        # Available memory
        self.free_memory = None #free memory is literally empty, while 
        self.available_memory = None # available memory can be freed up if need be
        self.update_free_memory_and_disk_space()
        
        #self.bits64 = (sys.maxsize > 2**32)
         
        # Paths
        self.addon_path = os.path.join(self.user_profile['addonsDir'], self.addon_name)
        self.data_dir_path = os.path.join(self.user_profile['dataDir'], self.addon_name)
        self.hostname_image_target_path = os.path.join(self.user_profile['gatewayDir'],'build','static','images','candle_hostname.svg')

        #print("self.user_profile: " + str(self.user_profile))

        # Make sure the work directory exists
        self.work_dir = os.path.join(self.user_profile['baseDir'], 'work','candleappstore')
        self.work_dir_package_path = os.path.join(self.work_dir,'package')
        self.work_dir_package_manifest_path = os.path.join(self.work_dir_package_path,'manifest.json')
        if not os.path.isdir(self.work_dir):
            os.system('mkdir -p ' + str(self.work_dir))
        
        if os.path.isdir(self.work_dir):
            os.system('rm -rf ' + os.path.join(str(self.work_dir),'*'))

        self.web_cache_addon_dir_path = os.path.join(self.addon_path, 'web_cache')
        self.web_cache_data_dir_path = os.path.join(self.data_dir_path, 'web_cache')
        self.web_cache_data_screenshots_dir_path = os.path.join(self.web_cache_data_dir_path, 'screenshots')
        self.web_cache_data_icons_dir_path = os.path.join(self.web_cache_data_dir_path, 'icons')
        if not os.path.isdir(str(self.web_cache_data_screenshots_dir_path)):
            os.system('mkdir -p ' + str(self.web_cache_data_screenshots_dir_path))
        if not os.path.isdir(str(self.web_cache_data_icons_dir_path)):
            os.system('mkdir -p ' + str(self.web_cache_data_icons_dir_path))
        
        #self.DEBUG = True
        
        # Create soft link so that the data/web_cache dir becomes web-accessible
        if os.path.isdir(str(self.web_cache_data_dir_path)):
            if os.path.isdir(str(self.web_cache_addon_dir_path)):
                symlink_check = str(run_command('stat ' + str(self.web_cache_addon_dir_path)))
                if 'symbolic link' in symlink_check:
                    if self.DEBUG:
                        print("web_cache dir is already a symbolic link")
                else:
                    if self.DEBUG:
                        print("web_cache dir is not a symbolic link yet")
                    
                    candleappstore_screenshot_source = os.path.join(self.web_cache_addon_dir_path,'screenshots','candleappstore_screenshot.jpg')
                    candleappstore_screenshot_target = os.path.join(self.web_cache_data_dir_path,'screenshots','candleappstore_screenshot.jpg')
                    if os.path.isfile(candleappstore_screenshot_source) and not os.path.isfile(candleappstore_screenshot_target):
                        if self.DEBUG:
                            print("moving candleappstore screenshot.jpg")
                        os.system('mkdir -p ' + os.path.join(str(self.web_cache_data_dir_path),'screenshots'))
                        os.system('mv ' + str(candleappstore_screenshot_source) + ' ' + str(candleappstore_screenshot_target))
                    
                    if os.path.isfile( os.path.join(self.web_cache_data_dir_path,'screenshots','candleappstore_screenshot.jpg')):
                        # Make sure there is nothing in the addon folder before creating the symlink to the /data folder there
                        os.system('rm -rf ' + str(self.web_cache_addon_dir_path))
                    
                        # Create symlink between data and addon folder
                        soft_link = 'ln -s ' + str(self.web_cache_data_dir_path) + " " + str(self.web_cache_addon_dir_path)
                        if self.DEBUG:
                            print("soft link command:\n" + soft_link)
                        os.system(soft_link)
                    else:
                        #if self.DEBUG:
                        print("error, moving initial screenshot to web_cache dir failed")                        

        # Make sure the data directory exists
        try:
            if not os.path.isdir(self.data_dir_path):
                os.mkdir( self.data_dir_path )
                print("data directory did not exist, created it now")
        except Exception as ex:
            print("Error: could not make sure data dir exists: " + str(ex))

        # Cached files paths
        self.cached_get_apps_path = os.path.join(self.data_dir_path,'get_apps_v' + str(self.candle_mayor_version) + '.json')
        if os.path.exists(self.cached_get_apps_path):
            os.system('rm ' + str(self.cached_get_apps_path)) # start without a cached version
        
        # determine the persistent data path
        self.persistence_file_path = os.path.join(self.data_dir_path, 'persistence.json')
        if self.DEBUG:
            print("self.persistence_file_path = " + str(self.persistence_file_path))
        
        
        
        self.last_versions_allowed_for_candle_v2 = {
            "webinterface":2010,
            "Candle-manager-addon":1003002,
            "activitypub-adapter":23,
            "airport":1001006,
            "awox-mesh-light-adapter":8,
            "azure-iot-bridge":1002003,
            "blinkt-adapter":2001,
            "bmp280-adapter":1003,
            "calendar":1001005,
            "chromecast-adapter":4005,
            "cololight-adapter":1000,
            "counter-adapter":3005,
            "cron-adapter":2007,
            "date-time-adapter":1002003,
            "dingz-adapter":3002,
            "display-toggle":1001009,
            "dmx-adapter":2000,
            "earthquake-monitor-adapter":3002,
            "email-sender-adapter":4001,
            "enocean-adapter":1008,
            "esphome-adapter":2002,
            "etekcity-adapter":5004,
            "eufy-adapter":3004,
            "flic-button-adapter":3003,
            "followers":8015,
            "foobot-adapter":4,
            "fritz-adapter":2003004,
            "frontier-silicon-adapter":8005,
            "generic-sensors-adapter":17,
            "github-adapter":2000,
            "google-home-adapter":1001002,
            "gotify-notifier":1003,
            "gpio-adapter":7005,
            "highlights":5006,
            "homekit-adapter":11000,
            "homematic-adapter":8001,
            "homie-adapter":2003,
            "http-adapter":7000,
            "influxdb-bridge":5001,
            "input-event-adapter":2005,
            "insteon-adapter":1000002,
            "internet-radio":2002014,
            "kafka-bridge":5004,
            "kodi-adapter":2002,
            "konnected-adapter":1001,
            "lametric-adapter":2001,
            "lg-tv-adapter":3006,
            "lifx-adapter":5000,
            "logitech-harmony-adapter":2010,
            "luftdaten-adapter":1001001,
            "macrozilla":1013,
            "magichome-adapter":3,
            "matrix-adapter":4003,
            "max-adapter":1009,
            "maxsmart2-adapter":1000,
            "medisana-ks250-adapter":1006,
            "meross-adapter":4002,
            "mi-flora-adapter":1000001,
            "miLight-adapter":6,
            "microblocks-adapter":5005,
            "modbus-adapter":4000,
            "modbus-bridge":2001,
            "mqtt-bridge":2,
            "myq-adapter":1002,
            "mysensors-adapter":1004002,
            "mystrom-switch-adapter":1000007,
            "nanoleaf-adapter":1003,
            "netatmo-energy-adapter":3000003,
            "netatmo-weather-adapter":5002,
            "netgear-adapter":4,
            "network-presence-detection-adapter":2001008,
            "node-red-extension":2004,
            "onvif-adapter":3003,
            "opengarage-adapter":2001,
            "opensensemap-adapter":1004,
            "openuv-adapter":5001,
            "p1-adapter":3002,
            "philips-hue-adapter":1000005,
            "photo-frame":2000005,
            "piface-adapter":1002,
            "power-settings":3007008,
            "powerwall-adapter":1003,
            "privacy-manager":3009,
            "prometheus-bridge":9000,
            "prowl-adapter":2004,
            "psi-sg":1004004,
            "pulse-adapter":4002,
            "purpleair-adapter":1002001,
            "pushbullet-adapter":2002,
            "pushover-notifier":1002,
            "pushsafer-notifier":1002,
            "rf433-adapter":1004,
            "ring-adapter":9,
            "roku-adapter":2002,
            "run-program-adapter":3002,
            "ruuvitag-adapter":8000,
            "scene-control-adapter":1002,
            "scheduler-adapter":1001,
            "seashell":1000001,
            "sengled-adapter":3002,
            "sense-hat-adapter":9,
            "sensor-tag-adapter":1005,
            "serial-adapter":5003,
            "shelly-adapter":1009000,
            "simple-mqtt-adapter":1000007,
            "sipgate-adapter":2003,
            "slack-adapter":2003,
            "sonos-adapter":11000,
            "speed-test-adapter":3003,
            "spotify-adapter":6001,
            "serial-adapter":5003,
            "tankerkoenig-adapter":2004,
            "tapo-adapter":1,
            "tasmota-adapter":2000003,
            "telegram-sender-adapter":8,
            "tellstick-adapter":1000000,
            "systeminfo-adapter":1012002,
            "thing-url-adapter":5002,
            "tide-calendar-adapter":4003,
            "timer-adapter":1006002,
            "tplink-adapter":6003,
            "tradfri-adapter":4000,
            "ttn-adapter":2002,
            "tts-adapter":1004,
            "tuya-adapter":2007,
            "twilio-adapter":2002,
            "twitter-adapter":2004,
            "virtual-things-adapter":11000,
            "voco":4002024,
            "voice-addon":2002000,
            "wake-on-lan-adapter":2002,
            "weather-adapter":6001,
            "webhook-events":4000,
            "wemo-adapter":3003,
            "wled-adapter":3001,
            "x10-cm11-adapter":5001,
            "xiaomi-temperature-humidity-sensor-adapter":2001,
            "yamaha-adapter":2000,
            "yeelight-adapter":4003,
            "yo-notifier":1004,
            "zigbee-adapter":22000,
            "zigbee2mqtt-adapter":1002010,
            "zmote-adapter":2001,
            "zwave-adapter":10009,
            "energyuse":4005,
            "candleappstore":5020,
            "denon-adapter":1000001,
            "irusb-adapter":1000001,
            "candle-theme":2006012,
            "square-theme":1000006,
            "bluetoothpairing":5017,
            "webtio-hydroqc-addon":1003,
            "lumencache-adapter":1000000,
            "candlecam":1080,
            "scenes":1002,
            "tutorial":1000009,
            "candle-weather":14,
            "candle-zwave-adapter":11001,
            "matter-adapter":2025,
            "homebridge":1008,
            "browser":1000,
            "floorplanner":2,
            "buttoninput":2002,
            "soundsleeper":6,
            "toothbrush":1001,
            "dashboard":2008}
        
        
            
       # Get persistent data
        self.persistent_data = {}
        first_run = False
        try:
            if os.path.exists(self.persistence_file_path):
                with open(self.persistence_file_path, "r") as f:
                    self.persistent_data = json.load(f)
                    if self.DEBUG:
                        print("Persistence data was loaded succesfully.")
            else:
                print("warning, no persistent data was found. If you just installed the add-on then this is normal.")
                first_run = True
                
        except Exception as ex:
            first_run = True
            print("caught error loading persistent data: " + str(ex))
        

        #time.sleep(3) # give the network some more time to settle
        
        #self.mac = get_own_mac("wlan0")
        
        
            
        #print("self.hostname = " + str(self.hostname))
        #self.mac_zero = self.mac.replace(self.mac[len(self.mac)-1], '0')

        #print("mac = " + str(self.mac))
        #print("mac_zero = " + str(self.mac_zero))

        
        
        try:
            if 'unique_id' not in self.persistent_data: # to remember what the main candleappstore server is, for satellites.
                if self.DEBUG:
                    print("unique_id was not in persistent data, adding it now.")
                self.persistent_data['unique_id'] = generate_random_string(20)
                
            #if 'addons' not in self.persistent_data: # TODO: is this used for anything?
            #    if self.DEBUG:
            #        print("addons was not in persistent data, adding it now.")
            #    self.persistent_data['addons'] = {}
            
            # Permisisons not currently used anymore?
            if 'permissions' not in self.persistent_data:
                self.persistent_data['permissions'] = {}
                
            
                
            # should be used to find out of the candle webserver has fresh addon updates, but is unfinished
            if 'meta_updated_time' not in self.persistent_data:
                self.persistent_data['meta_updated_time'] = 0
                
            if 'previously_installed_versions' not in self.persistent_data:
                self.persistent_data['previously_installed_versions'] = {}
                self.save_persistent_data()
                
        except Exception as ex:
            if self.DEBUG:
                print("caught error fixing missing values in persistent data: " + str(ex))
        
        
        # LOAD CONFIG
        try:
            self.add_from_config()
        except Exception as ex:
            print("Error loading config: " + str(ex))
            
        #self.DEBUG = True
            
        #self.ssid = self.candleappstore_name + " " + self.persistent_data['unique_id'] + "_nomap"
        #print("ssid = " + str(self.ssid))
        
        #
        # Create UI
        #
        # Even if the user doesn't want to see a UI, it may be the case that the HTML is still loaded somewhere. So the API should be available regardless.
        
        try:
            self.api_handler = CandleappstoreAPIHandler(self, verbose=True)
            #self.manager_proxy.add_api_handler(self.api_handler)
            if self.DEBUG:
                print("Extension API handler initiated")
        except Exception as e:
            print("Failed to start API handler (this only works on gateway version 0.10 or higher). Error: " + str(e))


        # create or remove developer.txt from boot partition
        if self.developer:
            if self.DEBUG:
                print("creating developer.txt file")
            os.system('sudo touch ' + str(self.boot_path) + '/developer.txt')
            #os.system('sudo systemctl start rsyslog.service')
        else:
            if os.path.isfile(self.boot_path + '/developer.txt'):
                if self.DEBUG:
                    print("removing developer.txt file")
                os.system('sudo rm ' + str(self.boot_path) + '/developer.txt')



        # get data required to find optimal packages to install

        self.bits = 32
        try:
            bits_check = shell('getconf LONG_BIT')
            self.bits = int(bits_check)
            if self.DEBUG:
                print("System bits: " + str(self.bits))
        except Exception as ex:
            print("error getting bits of system: " + str(ex))

        
        self.python_version = '3.13'
        self.python_minor_version = 13
        try:
            python_check = shell('python3 --version')
            if self.DEBUG:
                print("python_check: " + str(python_check))
            python_check = python_check.replace("Python ", "")
            python_version_parts = python_check.split('.')
            if len(python_version_parts) == 3:
                self.python_version = str(python_version_parts[0]) + "." + str(python_version_parts[1])
                self.python_minor_version = int(python_version_parts[1])
            else:
                if self.DEBUG:
                    print("error, python version string did not consist of three parts: " + str(python_version_parts))
            if self.DEBUG:
                print("Python version: " + str(self.python_version))
        except Exception as ex:
            print("error getting Python version: " + str(ex))


        self.node_version = '12'
        try:
            node_check = shell('node --version')
            node_check = node_check.replace("v", "")
            node_version_parts = node_check.split('.')
            if len(node_version_parts) == 3:
                self.node_version = str(node_version_parts[0])
            if self.DEBUG:
                print("Node version: " + str(self.node_version))
        except Exception as ex:
            print("error getting Node version: " + str(ex))


        if self.DEBUG:
            print("Current working directory: " + str(os.getcwd()))
            print("End of candle app store adapter init")
            print("doing scans")
        # Find out which addons are really installed, and what their default settings are
        self.scan_installed_addons()

        # find out how big the addon directories are
        if not self.DEBUG:
            time.sleep(5)
        self.scan_addons_file_size()
        
        
        # Write hostname SVG image, which can be displayed in the controller network scanner at https://www.candlesmarthome.com/scanner
        try:
            self.hostname = get_own_hostname()
            self.hostname_svg = '<svg id="candle-hostname-svg" height="73" viewBox="0 0 500 73" width="500" xmlns="http://www.w3.org/2000/svg"><text id="candle-hostname-svg-text" fill="#fff" font-family="Arial" font-size="35" letter-spacing="7" x="16" y="50">' + str(self.hostname).title() + '</text></svg>'
            # self.hostname_icon_svg = '<svg id="candle-hostname-icon-svg" height="900" viewBox="0 0 900 900" width="900" xmlns="http://www.w3.org/2000/svg"><g id="candle-hostname-icon-logo" fill="#fff"><path d="m373.619415 107c87.458527 145.954956-25.31665 212.917175-35.178222 348.408051 0 90.199981 50.030822 163.408477 111.680572 163.408477 61.64978 0 111.680603-73.208496 111.680603-163.408477 2.20929-178.713044-93.493957-269.937409-188.182953-348.408051z"/><path d="m824 604.614014c0-60.047852-167.445496-108.726197-374-108.726197-206.554489 0-374 48.678345-374 108.726197 0 60.04779 167.445511 108.726135 374 108.726135 206.554504 0 374-48.678345 374-108.726135z" fill-rule="evenodd" opacity=".695792"/></g><text id="candle-hostname-icon-text" font-family="Arial" font-size="112" letter-spacing="2.24" x="263.819062" y="847">' + str(self.hostname).title() + '</text></svg>'
            
            if self.DEBUG:
                print("self.hostname_svg: " + str(self.hostname_svg))
            with open(self.hostname_image_target_path, 'w') as ff:
                ff.write(self.hostname_svg)
                if self.DEBUG:
                    print("wrote hostname SVG image to: " + str(self.hostname_image_target_path))
            if os.path.exists(self.hostname_image_target_path):
                os.chmod(self.hostname_image_target_path, 0o644)
                
        except Exception as ex:
            print("Error creating hostname_svg image: " + str(ex))
        
        
        self.ready = True
        
        if self.DEBUG:
            print("Starting the clock thread")
        try:
            t = threading.Thread(target=self.clock)
            t.daemon = True
            t.start()
        except:
            if self.DEBUG:
                print("Error starting the clock thread")



#
#  GET CONFIG
#

    # Read the settings from the add-on settings page
    def add_from_config(self):
        """Attempt to add all configured devices."""
        
        store_updated_settings = False
        
        try:
            database = Database('candleappstore')
            if not database.open():
                print("Could not open settings database")
                return
            
            config = database.load_config()
            database.close()
            
        except:
            print("Error! Failed to open settings database.")
        
        if not config:
            print("Error loading config from database")
            return
        
        #print(str(config))

        if 'Debugging' in config:
            self.DEBUG = bool(config['Debugging'])
            if self.DEBUG:
                print("Debugging enabled")        


        if 'Keep addon data when uninstalling' in config:
            if self.DEBUG:
                print("-Keep addon data when uninstalling preference was in config: " + str(config['Keep addon data when uninstalling']))
            self.keep_data_on_uninstall = bool(config['Keep addon data when uninstalling'])
        

        if 'Show developer options' in config:
            if self.DEBUG:
                print("-Developer preference was in config: " + str(config['Show developer options']))
            self.developer = bool(config['Show developer options'])  
        
        
        # Currently not used anymore. Settings are now stored in persistence.json where possible.
        try:
            # Store the settings that were changed by the add-on.
            if store_updated_settings:
                if self.DEBUG:
                    print("Storing overridden settings")

                database = Database('candleappstore')
                if not database.open():
                    print("Error, could not open settings database to store modified settings")
                    #return
                else:
                    database.save_config(config)
                    database.close()
                    if self.DEBUG:
                        print("Stored overridden preferences into the database")
        except Exception as ex:
            print("Error! Failed to store overridden settings in database: " + str(ex))
        
        
        # Candleappstore name
        try:
            if 'Candleappstore name' in config:
                if self.DEBUG:
                    print("-Candleappstore name is present in the config data.")
                self.candleappstore_name = str(config['Candleappstore name'])
        except Exception as ex:
            print("Error loading candleappstore name from config: " + str(ex))
        
        
        # Candleappstore password
        try:
            if 'Candleappstore password' in config:
                if self.DEBUG:
                    print("-Candleappstore password is present in the config data.")
                self.candleappstore_password = str(config['Candleappstore password'])
        except Exception as ex:
            print("Error loading candleappstore password from config: " + str(ex))
        

        # Api token
        try:
            if 'Authorization token' in config:
                if str(config['Authorization token']) != "":
                    self.token = str(config['Authorization token'])
                    self.persistent_data['token'] = str(config['Authorization token'])
                    if self.DEBUG:
                        print("-Authorization token is present in the config data.")
        except Exception as ex:
            if self.DEBUG:
                print("Error loading api token from settings: " + str(ex))




    def clock(self):
        if self.DEBUG:
            print("in clock")
        
        while self.running:
            time.sleep(1)
            
            addons_to_install_list = list(self.installing_addons_queue.keys())
            if len(addons_to_install_list) and self.busy_installing_addon == None:
                
                should_install_this_addon = None
                timestamp_to_beat = time.time()
                
                if 'candleappstore' in addons_to_install_list and 'failed_timestamp' in self.installing_addons_queue['candleappstore'] and self.installing_addons_queue['candleappstore']['failed_timestamp'] == None and 'done_timestamp' in self.installing_addons_queue['candleappstore'] and self.installing_addons_queue['candleappstore']['done_timestamp'] == None:
                    should_install_this_addon = 'candleappstore'
                elif 'power-settings' in addons_to_install_list and 'failed_timestamp' in self.installing_addons_queue['power-settings'] and self.installing_addons_queue['power-settings']['failed_timestamp'] == None and 'done_timestamp' in self.installing_addons_queue['power-setting'] and self.installing_addons_queue['power-setting']['done_timestamp'] == None:
                    should_install_this_addon = 'power-settings'
                elif 'candle-theme' in addons_to_install_list and 'failed_timestamp' in self.installing_addons_queue['candle-theme'] and self.installing_addons_queue['candle-theme']['failed_timestamp'] == None and 'done_timestamp' in self.installing_addons_queue['candle-theme'] and self.installing_addons_queue['candle-theme']['done_timestamp'] == None:
                    should_install_this_addon = 'candle-theme'
                else:
                    #should_install_this_addon = addons_to_install_list[0]
                    for candidate in addons_to_install_list:
                        #if self.DEBUG:
                        #    print("candidate addon to install next: ", candidate, self.installing_addons_queue[candidate])
                        
                        if not 'failed_timestamp' in self.installing_addons_queue[candidate]:
                            if self.DEBUG:
                                print("\nERROR, missing failed_timestamp from installing_addons_queue somehow. Candidate: ". candidate)
                            del self.installing_addons_queue[candidate]
                        
                        
                        if self.installing_addons_queue[candidate]['done_timestamp'] != None:
                            if int(self.installing_addons_queue[candidate]['done_timestamp']) < time.time() - 3600:
                                del self.installing_addons_queue[candidate]
                            continue
                        
                        if self.installing_addons_queue[candidate]['failed_timestamp'] != None:
                            if int(self.installing_addons_queue[candidate]['failed_timestamp']) < time.time() - 120:
                                del self.installing_addons_queue[candidate]
                            if self.DEBUG:
                                print("skipping installation of addon whose installation has already failed: ", candidate)
                            continue
                        
                        if 'request_timestamp' in self.installing_addons_queue[candidate] and int(self.installing_addons_queue[candidate]['request_timestamp']) < timestamp_to_beat:
                            if self.DEBUG:
                                print("this addon installation was requested even earlier: ", candidate)
                            
                            if int(self.installing_addons_queue[candidate]['request_timestamp']) < time.time() - (3600 * 2) and 'download_start_timestamp' in self.installing_addons_queue[candidate] and self.installing_addons_queue[candidate]['download_start_timestamp'] == None:
                                if self.DEBUG:
                                    print("this addon installation was requested over two hours ago, and somehow still hasn't started downloading? Removing it: ", candidate)
                                del self.installing_addons_queue[candidate]
                            
                            timestamp_to_beat = int(self.installing_addons_queue[candidate]['request_timestamp'])
                            should_install_this_addon = candidate
                    
                if should_install_this_addon != None:
                    if self.DEBUG:
                        print("clock selected a candidate addon to install next: ", candidate, self.installing_addons_queue[candidate])
                    
                    self.install_addon(should_install_this_addon)
            
            


    def install_addon(self,addon_id,addon_url=None,addon_checksum=None,update=False):
        if self.DEBUG:
            print("\n\n+\nin install_addon.  \naddon_id: ", addon_id, "\naddon_url: ", addon_url, "\naddon_checksum: ", addon_checksum, "\nupdate: ", update, "\n")
            
        if isinstance(addon_id,str) and len(addon_id) > 1:
            try:
                
                already_installed = False
            
                target_dir = os.path.join(self.user_profile['addonsDir'], addon_id)
                if os.path.isdir(target_dir):
                    if self.DEBUG:
                        print("install_addon: addon seems to already be installed: ", addon_id)
                    already_installed = True
                else:
                    if self.DEBUG:
                        print("install_addon: OK, addon does not seem to be already installed: ", addon_id)
                
                already_dir_in_work_dir = False
                addon_work_dir = str(os.path.join(self.work_dir, addon_id))
                if os.path.isdir(addon_work_dir):
                    if self.DEBUG:
                        print("Error, found a dir in work_dir with the addon's name. Did a previous installation fail?")
                    already_dir_in_work_dir = True
            
                tar_name = None
                addon_tar_path = None
                already_tar_in_work_dir = False
                if isinstance(addon_url,str) and addon_url.startswith('http') and (addon_url.endswith('.tgz') or addon_url.endswith('.tar.gz') ):
                    tar_name = os.path.basename(addon_url)
                    addon_tar_path = os.path.join(self.work_dir, tar_name)
                    if self.DEBUG:
                        print("install_addon: addon_tar_path: ", addon_tar_path)
                    if os.path.isfile(addon_tar_path):
                        already_tar_in_work_dir = True
                    
                    if not addon_id in self.installing_addons_queue:
                        self.installing_addons_queue[addon_id] = {
                                'addon_url':addon_url,
                                'addon_checksum':addon_checksum,
                                'request_timestamp':time.time(),
                                'download_start_timestamp':None,
                                'download_done_timestamp':None,
                                'start_timestamp':None,
                                'done_timestamp':None,
                                'failed_timestamp':None,
                                'download_size':None,
                                'downloaded_size':0,
                                'addon_tar_path':addon_tar_path,
                                'target_dir':target_dir,
                                'tar_name':tar_name,
                                'message':'Waiting to start',
                                'download_attempts':0,
                                'update':update
                            }
                elif not addon_id in list(self.installing_addons_queue.keys()):
                    if self.DEBUG:
                        print("\nERROR: install_addon: cannot add to queue: addon_url is invalid: ", addon_url)
                
                
                if addon_id in self.installing_addons_queue:
                    self.installing_addons_queue[addon_id]['already_installed'] = already_installed
                    self.installing_addons_queue[addon_id]['already_tar_in_work_dir'] = already_tar_in_work_dir
                    self.installing_addons_queue[addon_id]['already_dir_in_work_dir'] = already_dir_in_work_dir
                else:
                    if self.DEBUG:
                        print("\nERROR, addon_id is not in installation queue somehow: ", addon_id)
                    return False
                
                
                # If an addon_checksum is provided, then we stop here
                if isinstance(addon_checksum,str): # and not 'addon_checksum' in self.installing_addons_queue[addon_id]:
                    self.installing_addons_queue[addon_id]['addon_checksum'] = addon_checksum
                    if self.DEBUG:
                        print("added checksum for new addon to installation queue: ", addon_id)
                
                if isinstance(addon_url,str): # and not 'addon_checksum' in self.installing_addons_queue[addon_id]:
                    if self.DEBUG:
                        print("Stopping install_addon early because a download URL was provided. Added to queue only.")
                    return True
            
                if 'failed_timestamp' in self.installing_addons_queue[addon_id] and self.installing_addons_queue[addon_id]['failed_timestamp'] != None:
                    if self.DEBUG:
                        print("Error, almost started an already failed installation again: ", self.installing_addons_queue[addon_id])
                    return True
            
            
            
                if str(addon_id) in self.installing_addons_queue and 'addon_url' in self.installing_addons_queue[addon_id] and 'addon_tar_path' in self.installing_addons_queue[addon_id] and isinstance(self.installing_addons_queue[addon_id]['addon_tar_path'],str):
            
                    if self.busy_installing_addon == None:
                        self.busy_installing_addon = str(addon_id)
                    
                        self.installing_addons_queue[addon_id]['start_timestamp'] = time.time()
                        self.installing_addons_queue[addon_id]['message'] = 'Starting'
                    
                        try:
                            response = requests.get(str(self.installing_addons_queue[addon_id]['addon_url']), stream=True)
                            response.raise_for_status()

                            total_size = int(response.headers.get('content-length', 0))
                            if total_size:
                                self.installing_addons_queue[str(addon_id)]['download_size'] = int(total_size)
                                self.installing_addons_queue[str(addon_id)]['downloaded_size'] = 0
                        
                            downloaded_size = 0
                            
                            if os.path.isfile(str(self.installing_addons_queue[addon_id]['addon_tar_path'])):
                                self.installing_addons_queue[addon_id]['message'] = 'Removing left-over file from previous download attempt'
                                os.system('rm ' + str(self.installing_addons_queue[addon_id]['addon_tar_path']))
                                time.sleep(1)
                                
                            self.update_free_memory_and_disk_space()
                                
                            # untarring will also take space, and if we're replacing an old addon, that takes even more space for the short period while they are both on disk
                            if self.user_partition_free_disk_space and int(self.user_partition_free_disk_space) < (total_size * 4): 
                                self.installing_addons_queue[addon_id]['message'] = 'Not enough free disk space'
                                self.installing_addons_queue[addon_id]['failed_timestamp'] = time.time()
                                time.sleep(1)
                                self.busy_installing_addon = None
                                return False
                                
                            
                        
                            if not os.path.isfile(str(self.installing_addons_queue[addon_id]['addon_tar_path'])):
                                chunk_size=8192
                                with open(str(self.installing_addons_queue[addon_id]['addon_tar_path']), 'wb') as f:
                                    self.installing_addons_queue[addon_id]['download_start_timestamp'] = time.time()
                                    
                                    if self.installing_addons_queue[addon_id]['update']:
                                        self.installing_addons_queue[addon_id]['message'] = 'Downloading update'
                                    else:
                                        self.installing_addons_queue[addon_id]['message'] = 'Downloading'
                                        
                                    if self.DEBUG:
                                        print("\n\n\n--- DOWNLOADING ---\n" + str(self.installing_addons_queue[addon_id]['addon_url']) + "\nTo: " + str(self.installing_addons_queue[addon_id]['addon_tar_path']) + "\n\n\n")
                                
                                    for chunk in response.iter_content(chunk_size=chunk_size):
                                        if chunk:
                                            f.write(chunk)
                                            downloaded_size += len(chunk)
                                            self.installing_addons_queue[addon_id]['downloaded_size'] = int(downloaded_size)
                                            if total_size == 0:
                                                done = 0
                                            else:
                                                done = int(50 * downloaded_size / total_size)
                    
                                            #if self.DEBUG:
                                            #    print(f"\r[{'█' * done}{' ' * (50 - done)}] {downloaded_size}/{total_size} bytes", end='')
        
                            
                                if not os.path.isfile(str(self.installing_addons_queue[addon_id]['addon_tar_path'])):
                                    if self.DEBUG:
                                        print("file was not downloaded to expected addon_tar_path: ", str(self.installing_addons_queue[addon_id]['addon_tar_path']))
                                    self.installing_addons_queue[addon_id]['message'] = 'Error, failed to download'
                                    self.installing_addons_queue[addon_id]['failed_timestamp'] = time.time()
                                    time.sleep(3)
                                    self.busy_installing_addon = None
                                    return False
                                else:
                                    if isinstance(self.installing_addons_queue[addon_id]['downloaded_size'],int) and int(self.installing_addons_queue[addon_id]['downloaded_size']) > 0:
                                        self.installing_addons_queue[addon_id]['download_done_timestamp'] = time.time()
                                
                                
                                    # Validate checksum is available
                                    if isinstance(self.installing_addons_queue[addon_id]['addon_checksum'],str) and len(str(self.installing_addons_queue[addon_id]['addon_checksum'])) > 5:
                                        md5_of_downloaded_file = str(run_command("shasum --algorithm 256 " + str(self.installing_addons_queue[addon_id]['addon_tar_path']) + "| awk '{print $1}'")).strip().rstrip()
                                    
                                        if self.DEBUG:
                                            print("provided checksum:      -->" + str(self.installing_addons_queue[addon_id]['addon_checksum']) + "<--")
                                            print("md5_of_downloaded_file: -->" + str(md5_of_downloaded_file) + "<--")
                                    
                                        if md5_of_downloaded_file == self.installing_addons_queue[addon_id]['addon_checksum']:
                                            if self.DEBUG:
                                                print("OK, MD5 checksum of downloaded file matched")
                                        else:
                                            if self.DEBUG:
                                                print("\nERROR, MD5 checksum of downloaded file did NOT match")
                                            self.installing_addons_queue[addon_id]['message'] = 'File did not download correctly'
                                        
                                            if self.installing_addons_queue[addon_id]['download_attempts'] == 0:
                                                self.installing_addons_queue[addon_id]['downloaded_size'] = 0
                                                self.installing_addons_queue[addon_id]['download_start_timestamp'] = None
                                                self.installing_addons_queue[addon_id]['download_done_timestamp'] = None
                                                self.installing_addons_queue[addon_id]['start_timestamp'] = None
                                            
                                            else:
                                                self.installing_addons_queue[addon_id]['failed_timestamp'] = time.time()
                                                self.installing_addons_queue[addon_id]['message'] = 'Second attempt to download file also failed'
                                            self.installing_addons_queue[addon_id]['download_attempts'] += 1
                                            os.system('rm ' + str(self.installing_addons_queue[addon_id]['addon_tar_path']))
                                            time.sleep(3)
                                            self.busy_installing_addon = None
                                            return
                                
                                
                                    if os.path.isdir(str(self.work_dir_package_path)):
                                        os.system('rm -rf ' + str(self.work_dir_package_path))
                                        self.installing_addons_queue[addon_id]['message'] = 'Removing left-over folder from a previous download attempt'
                                        time.sleep(1)
                                    
                                    if not os.path.isdir(str(self.work_dir_package_path)):
                                        self.installing_addons_queue[addon_id]['message'] = 'Unzipping downloaded file'
                                        unpack_check = run_command('tar xf ' + str(self.installing_addons_queue[addon_id]['addon_tar_path']) + ' -C ' + str(self.work_dir), 600) # allow unpacking for up to 10 minutes
                                        time.sleep(1)
                                        #if unpack_check == None:
                                        #    self.installing_addons_queue[addon_id]['message'] = 'Extracting the downloaded file failed'
                                        #    self.installing_addons_queue[addon_id]['failed_timestamp'] = time.time()
                                        #el
                                    
                                        if os.path.isdir(self.work_dir_package_path):
                                            if os.path.isfile(self.work_dir_package_manifest_path):
                                                
                                                if not 'manifest' in self.installing_addons_queue[addon_id]:
                                                    if self.DEBUG:
                                                        print("adding raw manifest.json contents to installing_addons_queue");
                                                    self.installing_addons_queue[addon_id]['manifest'] = str(run_command('cat ' + str(self.work_dir_package_manifest_path)))
                                                
                                                if os.path.isfile(str(self.installing_addons_queue[addon_id]['addon_tar_path'])):
                                                    os.system('rm ' + str(self.installing_addons_queue[addon_id]['addon_tar_path']))
                                            
                                                if os.path.isdir(str(self.installing_addons_queue[addon_id]['target_dir'])):
                                                    if self.DEBUG:
                                                        print("deleting addon's old directory first. No way back now.")
                                                    os.system('mv ' + str(self.installing_addons_queue[addon_id]['target_dir']) + ' ' + str(self.installing_addons_queue[addon_id]['target_dir']) + '_bak')
                                                    self.installing_addons_queue[addon_id]['message'] = 'Replacing old addon with the new one'
                                                    time.sleep(1)
                                                else:
                                                    self.installing_addons_queue[addon_id]['message'] = 'Moving downloaded addon into addons folder'
                                            
                                                if not os.path.isdir(str(self.installing_addons_queue[addon_id]['target_dir'])):
                                                    os.system('mv ' + str(self.work_dir_package_path) + ' ' + str(self.installing_addons_queue[addon_id]['target_dir']))
                                                
                                                if os.path.isdir(str(self.installing_addons_queue[addon_id]['target_dir'])) and not os.path.isdir(self.work_dir_package_path):
                                                    
                                                    try:
                                                        if os.path.isdir(str(self.installing_addons_queue[addon_id]['target_dir']) + '_bak'):
                                                            # If there is at least a few of free disk space available, then creating an initial backup of the addon isn't a bad idea
                                                            if self.user_partition_free_disk_space > 3000000000 and os.path.isdir('/home/pi/.webthings/backups/addons') and not os.path.isdir('/home/pi/.webthings/backups/addons/' + str(addon_id)):
                                                                if self.DEBUG:
                                                                    print("creating initial backup copy of the addon")
                                                                self.installing_addons_queue[addon_id]['message'] = 'Making the old version available as a troubleshooting backup'
                                                                os.system('mv ' + str(self.installing_addons_queue[addon_id]['target_dir']) + '_bak /home/pi/.webthings/backups/addons/' + str(addon_id))
                                                            else:
                                                                os.system('rm ' + str(self.installing_addons_queue[addon_id]['target_dir']) + '_bak')
                                                    except Exception as ex:
                                                        if self.DEBUG:
                                                            print("caught error after addon was just installed: ", ex)
                                                    
                                                    time.sleep(1)
                                                    if self.installing_addons_queue[addon_id]['update']:
                                                        self.installing_addons_queue[addon_id]['message'] = "Analyzing update's features"
                                                    else:
                                                        self.installing_addons_queue[addon_id]['message'] = "Analyzing new addon's features"
                                                    self.installing_addons_queue[addon_id]['has_ui'] = self.check_if_addon_has_ui(addon_id)
                                                    self.installing_addons_queue[addon_id]['has_things'] = self.check_if_addon_has_things(addon_id)
                                                    time.sleep(1)
                                                    if self.installing_addons_queue[addon_id]['update']:
                                                        self.installing_addons_queue[addon_id]['message'] = 'Update complete'
                                                    else:
                                                        self.installing_addons_queue[addon_id]['message'] = 'Installation complete'
                                                    
                                                    if 'previously_installed_versions' not in self.persistent_data:
                                                        self.persistent_data['previously_installed_versions'] = {}
                                                    if addon_id not in self.persistent_data['previously_installed_versions']:
                                                        self.persistent_data['previously_installed_versions'][addon_id] = []
                                                    
                                                    was_previously_installed = False
                                                    for previously_installed_version in self.persistent_data['previously_installed_versions'][addon_id]:
                                                        if isinstance(previously_installed_version,dict):
                                                            if 'addon_url' in previously_installed_version and str(previously_installed_version['addon_url']) == str(self.installing_addons_queue[addon_id]['addon_url']):
                                                                was_previously_installed = True
                                                                if self.DEBUG:
                                                                    print("it seems this addon has been installed before, it's download URL was spotted in persistent data's previously_installed_versions")
                                                                break
                                                    if was_previously_installed == False:
                                                        previously_installed_item = {
                                                                'addon_url':str(self.installing_addons_queue[addon_id]['addon_url']),
                                                                'first_install_timestamp':int(time.time())
                                                                }
                                                        if isinstance(self.installing_addons_queue[addon_id]['download_size'],int) and self.installing_addons_queue[addon_id]['download_size'] > 0:
                                                            previously_installed_item['download_size'] = int(self.installing_addons_queue[addon_id]['download_size'])
                                                        if isinstance(self.installing_addons_queue[addon_id]['addon_checksum'],str) and len(str(self.installing_addons_queue[addon_id]['addon_checksum'])) > 5:
                                                            previously_installed_item['addon_checksum'] = self.installing_addons_queue[addon_id]['addon_checksum']
                                                        if self.DEBUG:
                                                            print("adding previously_installed_item to previously_installed_versions history: ", previously_installed_item)
                                                        self.persistent_data['previously_installed_versions'][addon_id].append(previously_installed_item)
                                                    else:
                                                        if self.DEBUG:
                                                            print("this version has been installed before. Not adding it to previously_installed_versions history: ", addon_id)
                                                    
                                                    self.installing_addons_queue[addon_id]['done_timestamp'] = time.time()
                                                    self.busy_installing_addon = None
                                                else:
                                                    if self.DEBUG:
                                                        print("Failed to move the addon into place")
                                                    self.installing_addons_queue[addon_id]['message'] = 'Failed to move the addon into place'
                                                    self.installing_addons_queue[addon_id]['failed_timestamp'] = time.time()
                                                    time.sleep(1)
                                                    self.busy_installing_addon = None
                                                
                                            else:
                                                if self.DEBUG:
                                                    print("missing manifest.json in downloaded addon: ", self.work_dir_package_manifest_path)
                                                self.installing_addons_queue[addon_id]['message'] = 'Downloaded addon is missing its manifest.json file'
                                                self.installing_addons_queue[addon_id]['failed_timestamp'] = time.time()
                                                time.sleep(1)
                                                self.busy_installing_addon = None
                                        else:
                                            if self.DEBUG:
                                                print("package dir is missing")
                                            self.installing_addons_queue[addon_id]['message'] = 'Downloaded file does not contain an addon?'
                                            self.installing_addons_queue[addon_id]['failed_timestamp'] = time.time()
                                            time.sleep(1)
                                            self.busy_installing_addon = None
                                            
                                            
                        except requests.exceptions.RequestException as ex:
                            if self.DEBUG:
                                print("caught error downloading/installing an addon: ", ex)
                            self.installing_addons_queue[addon_id]['message'] = 'An error occured while downloading'
                            self.installing_addons_queue[addon_id]['failed_timestamp'] = time.time()
                            self.busy_installing_addon = None
                        
                    
                        except Exception as ex:
                            if self.DEBUG:
                                print("caught error installing an addon: ", ex)
                            self.installing_addons_queue[addon_id]['message'] = 'An error occured while installing'
                            self.installing_addons_queue[addon_id]['failed_timestamp'] = time.time()
                            self.busy_installing_addon = None
                
                
            except Exception as ex:
                if self.DEBUG:
                    print("install_addon: caught error: ", ex)
                self.busy_installing_addon = None

        else:
            if self.DEBUG:
                print("\nERROR: install_addon: provided addon_id was not a valid string: ", addon_id)
        
        try:
            self.installed_addons = self.scan_installed_addons()
            self.scan_addons_file_size()

        except Exception as ex:
            if self.DEBUG:
                print("install_addon: caught error updating installed_addons list: " + str(ex))
                
        self.busy_installing_addon = None
        return False





    # returns list of installed addons by scanning addons directory. 
    # Also grabs default addon settings from manifest files
    def scan_installed_addons(self):
        start_time = time.time()
        if self.DEBUG:
            print("in scan_installed_addons")
        real_dirs = []
        new_default_settings = {}
        #if self.DEBUG:
        #    print("self.user_profile['addonsDir'] = " + str(self.user_profile['addonsDir']))
        try:
            raw_dirs = os.listdir( self.user_profile['addonsDir'] )
            for dirname in raw_dirs:
                if os.path.isdir( os.path.join(self.user_profile['addonsDir'],dirname) ):
                    real_dirs.append(dirname)
                    
                    # get default addon settings from manifest file
                    try:
                        manifest_path = str(os.path.join(self.user_profile['addonsDir'],dirname,'manifest.json'))
                        #print("manifest_path: " + str(manifest_path))
                        if os.path.isfile(manifest_path):
                            #print('manifest file exists: ' + str(manifest_path))
                            
                            with open(manifest_path) as manifest_file:
                                parsed_json = json.load(manifest_file)
                                #print(parsed_json)
                                #print("\n\nLOADED JSON: " + str(parsed_json['options']['default']))
                                #if self.DEBUG:
                                #    print("loaded manifest: " + str(manifest_path))
                                defaults = {}
                                if 'options' in parsed_json:
                                    if 'default' in parsed_json['options']:
                                        new_default_settings[dirname] = parsed_json['options']['default']
                                    else:
                                        if self.DEBUG:
                                            print("addon did not have default settings?: ", dirname)
                                
                        else:
                            if self.DEBUG:
                                print("\nERROR, addon did not have a manifest?  manifest_path: \n", str(manifest_path))
                    except Exception as ex:
                        if self.DEBUG:
                            print("caught error getting default addon settings from manifest: ", ex)
                            
                    # See if the addon has an icon, and if so, copy it to the web cache folder so it's always available, even if the addon is disabled
                    try:
                        possible_icon_names = ['menu-icon.svg','menu_icon.svg'];
                        for possible_icon_name in possible_icon_names:
                            
                            icon_source_path = str(os.path.join(self.user_profile['addonsDir'],dirname,'images',str(possible_icon_name)))
                            
                            #if self.DEBUG:
                            #    print("testing icon_source_path: " + str(icon_source_path))
                            if os.path.isfile(icon_source_path):
                                if self.DEBUG:
                                    print("spotted addon icon at: ", icon_source_path)
                                
                                target_web_cache_icon_dir = os.path.join(self.web_cache_data_icons_dir_path,dirname)
                                if not os.path.isdir(target_web_cache_icon_dir):
                                    os.system('mkdir -p ' + str(target_web_cache_icon_dir))
                                
                                target_web_cache_icon_path = os.path.join(target_web_cache_icon_dir,'menu-icon.svg')
                                if not os.path.isfile(target_web_cache_icon_path):
                                    if self.DEBUG:
                                        print("Copying addon icon to: ", target_web_cache_icon_path)
                                    os.system('cp ' + str(icon_source_path) + ' ' + str(target_web_cache_icon_path))
 
                    except Exception as ex:
                        if self.DEBUG:
                            print("caught error looking for icon: ", ex)
                    
        except Exception as ex:
            if self.DEBUG:
                print("could not get list of actually installed addons directories: " + str(ex))
        
        self.addon_defaults = new_default_settings
        #print("self.addon_defaults: " + str(self.addon_defaults))
        
        # also update how much memory is available
        self.update_free_memory_and_disk_space()
        
        end_time = time.time()
        if self.DEBUG:
            print("scan_installed_addons: time taken: " + str(end_time - start_time))
            
        return real_dirs

    
    # Find out how big the addons are
    def scan_addons_file_size(self):
        start_time = time.time()
        
        if self.DEBUG:
            print("in scan_addons_file_size")
        
        file_sizes = shell('du ' + str(self.user_profile['addonsDir']) + ' --max-depth=1')
        for line in file_sizes.splitlines():
            try:
                line_parts1 = line.split('\t')
                line_parts2 = line.split('addons/')
                
                if len(line_parts1) > 1 and len(line_parts2) > 1:
                    self.addon_sizes[ line_parts2[1] ] = int( line_parts1[0] )
                elif len(line_parts1) > 0 and line.endswith('/addons'):
                    self.total_addons_size = int( line_parts1[0] )
                    
            except Exception as ex:
                print("Error parsing addon file size scan line: " + str(ex))
        
        if self.DEBUG:
            print("self.addon_sizes: " + str(self.addon_sizes) )
            print("self.total_addons_size: " + str(self.total_addons_size))
        
        # also update how much memory is available
        self.update_free_memory_and_disk_space()
        
        end_time = time.time()
        if self.DEBUG:
            print("scan_addons_file_size: time taken: " + str(end_time - start_time))
            
            
    def install_addon_from_url(self,url,addon_id,new_version=None):
        if self.DEBUG:
            print("in install_addon_from_url.  addon_id,url: ", addon_id, url)
        succes = False
        if self.busy_installing_addon_from_url == False and isinstance(url,str) and isinstance(addon_id,str) and len(addon_id) > 1 and url.startswith('https://'):
            self.busy_installing_addon_from_url = True
            try:
                
                if os.path.isdir('/home/pi/.webthings/addons/' + str(addon_id) + '/.git'):
                    print("install_addon_from_url: aborting, .git folder spotted. Addon_id was: ", addon_id)
                    return False
                
                tar_filename = str(url).rsplit('/', 1)[-1]
                if tar_filename.endswith('.tgz'):
                    if os.path.isdir('/home/pi/.webthings/addons/package'):
                        time.sleep(1)
                        if os.path.isdir('/home/pi/.webthings/addons/package'):
                            os.system('rm -rf /home/pi/.webthings/addons/package*') # delete all dirs that start with package. This could be an issue if an addon called 'package' exists. Could download and unpack in an outside working directory first
                            if self.DEBUG:
                                print("\nERROR, install_addon_from_url noticed that a directory called 'package' already existed. It has been deleted")
                    
                    download_command = "cd /home/pi/.webthings/addons; wget --retry-connrefused --waitretry=1 --read-timeout=20 --timeout=15 -t 3 " + str(url) + "; tar xf " + tar_filename
                    if self.DEBUG:
                        print("addon download_command: \n\n" +str(download_command) + "\n\n")
                        
                    download_output = run_command(download_command)
                    if isinstance(download_output,str):
                        if self.DEBUG:
                            print("install_addon_from_url: download_output: \n\n", download_output, "\n\n")
                            
                    if os.path.isdir('/home/pi/.webthings/addons/package'):
                        succes = True
                        if os.path.isdir('/home/pi/.webthings/addons/' + addon_id):
                            os.system('rm -rf /home/pi/.webthings/addons/' + addon_id)
                            
                        os.system('mv /home/pi/.webthings/addons/package /home/pi/.webthings/addons/' + str(addon_id))
                        if os.path.isdir('/home/pi/.webthings/addons/package'):
                            succes = False
                            os.system('rm -rf /home/pi/.webthings/addons/package')
                        
                    os.system('rm /home/pi/.webthings/addons/*.tgz')
                    time.sleep(1)
                    self.busy_installing_addon_from_url = False
                    
                    succes = (succes and os.path.isdir('/home/pi/.webthings/addons/' + addon_id))
                    if succes and isinstance(new_version,str):
                        version_check = run_command('cat manifest.json | grep \'"version"\' | awk \'{print $2}\'')
                        if isinstance(version_check,str):
                            version_check = version_check.replace('"','')
                            version_check = version_check.replace(',','').rstrip()
                            if version_check != new_version:
                                if self.DEBUG:
                                    print("\ninstall_addon_from_url: ERROR, there seems to be a version mismatch: -->" + str(new_version) + "<-- != -->" + str(version_check) + "<--")
                            else:
                                if self.DEBUG:
                                    print("install_addon_from_url: OK, installed version matches with the intended version: " + str(new_version))
                                self.pre_release_addons[addon_id] = new_version
                                
                    return succes
            except Exception as ex:
                print("caught error in install_addon_from_url: ", ex)
                
        self.busy_installing_addon_from_url = False    
        return False
            
    
    
    
    def web_cache(self,urls):
        if self.DEBUG:
            print("in web_cache. urls: ", urls)
        results = []
        if isinstance(urls,list):
            for url_to_cache in urls:
                try:
                    if self.DEBUG:
                        print("web_cache: url_to_cache: ", url_to_cache)
                    if 'to' in url_to_cache.keys():
                        target_file_path = self.web_cache_data_dir_path + '/' + url_to_cache['to']
                        if self.DEBUG:
                            print("web_cache:  target_file_path: ", target_file_path)
                        if not os.path.isfile(target_file_path) and str(url_to_cache['from']).startswith('http'): # and (str(url_to_cache['from']).endswith('.jpg') or str(url_to_cache['from']).endswith('.png')):
                            filename = os.path.basename(target_file_path)
                            download_dir = target_file_path.rstrip(filename)
                            if not os.path.isdir(download_dir):
                                if self.DEBUG:
                                    print("creating directory to cache file to first: ", download_dir)
                                os.system('mkdir -p ' + str(download_dir))
                            if self.DEBUG:
                                print("web_cache: downloading url_to_cache to: ", target_file_path)
                            wget_command = 'wget ' + str(url_to_cache['from']) + ' -O ' + str(target_file_path)
                            if self.DEBUG:
                                print("wget_command: ", wget_command)
                            wget_check = str(run_command(wget_command))
                            if self.DEBUG:
                                print("wget_check: ", wget_check)
                        if os.path.isfile(target_file_path):
                            if self.DEBUG:
                                print("web_cache: OK, cached file (now) exists: ", target_file_path)
                            results.append(url_to_cache)
                except Exception as ex:
                    print("\nERROR: web_cache: ", ex)

        if self.DEBUG:
            print("web_cache: returning results: ", results)
        return results
        
        
        
    def check_if_addon_has_ui(self,addon_id):
        likely_has_ui = False
        target_dir = os.path.join(self.user_profile['addonsDir'], str(addon_id))
        if os.path.isdir(target_dir):
            if os.path.isdir(os.path.join(target_dir,'views')) and os.path.isdir(os.path.join(target_dir,'js')):
                likely_has_ui = True
        
        return likely_has_ui
                
        # TODO: could scan for 'APIHandler' in text
    
    
    def check_if_addon_has_things(self,addon_id):
        likely_has_things = False
        target_dir = os.path.join(self.user_profile['addonsDir'], str(addon_id))
        if os.path.isdir(target_dir):
            things_check = run_command("grep -r 'Device.__init__(' " + str(target_dir ))
            if isinstance(things_check,str):
                if self.DEBUG:
                    print("check_if_addon_has_things: Device.__init__( check: \n\n", things_check,"\n\n")
                occurence_count = 0
                for line in str(things_check).splitlines():
                    if '//' in line and line.find("//") < line.find('Device.__init__('):
                        if self.DEBUG:
                            print("check_if_addon_has_things: Device.__init__( seems to be commented out with //")
                        pass
                    elif '#' in line and line.find("#") < line.find('Device.__init__('):
                        if self.DEBUG:
                            print("check_if_addon_has_things: Device.__init__( seems to be commented out with #")
                        pass
                    else:
                        occurence_count += 1
                        likely_has_things = True
                
                if self.DEBUG:
                    print("check_if_addon_has_things: notifyPropertyChanged occurence_count: ", occurence_count)
                if likely_has_things == False:
                    things_check = run_command("grep -r 'notifyPropertyChanged(' " + str(target_dir ))
                    if(isinstance(things_check,str)) and 'notifyPropertyChanged(' in things_check:
                        occurence_count += 1
                        likely_has_things = True
                    
                    if self.DEBUG:
                        print("check_if_addon_has_things: occurence_count after also checking for handleDeviceAdded: ", occurence_count)
                        
                    if occurence_count > 1:
                        likely_has_things = True
            else:
                if self.DEBUG:
                    print("ERROR:  check_if_addon_has_things: run_command returned null")
        else:
            if self.DEBUG:
                print("ERROR:  check_if_addon_has_things: could not find addon's dir for addon_id: ", addon_id)
        return likely_has_things
    
    
            
    def update_free_memory_and_disk_space(self):
        if self.DEBUG:
            print("in update_free_memory_and_disk_space")
        try:
            # Available disk space
            self.user_partition_free_disk_space = int(shell("df /home/pi/.webthings | awk 'NR==2{print $4}' | tr -d '\n'")) * 1000
            
            # Check free memory
            free_memory = subprocess.check_output(['grep','^MemFree','/proc/meminfo'])
            free_memory = free_memory.decode('utf-8')
            self.free_memory = int( int(''.join(filter(str.isdigit, free_memory))) / 1000)
            if self.DEBUG:
                print("free_memory: " + str(free_memory))
            
            # Check available memory
            available_memory = subprocess.check_output("free | grep Mem:", shell=True)
            available_memory = available_memory.decode('utf-8')
            available_memory_parts = available_memory.split()
            available_memory = available_memory_parts[-1]
            self.available_memory = int( int(''.join(filter(str.isdigit, available_memory))))
            if self.DEBUG:
                print("available_memory: " + str(available_memory))
            
        except Exception as ex:
            print("Error getting memory / free user partition disk space: " + str(ex))
            
            
    def remove_thing(self, device_id):
        try:
            obj = self.get_device(device_id)        
            self.handle_device_removed(obj) # Remove candleappstore thing from device dictionary
            if self.DEBUG:
                print("User removed Candleappstore device")
        except:
            if self.DEBUG:
                print("Could not remove things from devices")



#
#  PAIRING
#

    def start_pairing(self, timeout):
        """
        Start the pairing process. This starts when the user presses the + button on the things page.
        
        timeout -- Timeout in seconds at which to quit pairing
        """
        if self.pairing:
            #print("-Already pairing")
            return
          
        self.pairing = True
        return
    
    
    
    def cancel_pairing(self):
        """Cancel the pairing process."""
        self.pairing = False
        if self.DEBUG:
            print("End of pairing process. Checking if a new injection is required.")





#
#  UNLOAD
#

    def unload(self):
        if self.DEBUG:
            print("Shutting down Candleappstore")
        
        self.save_persistent_data()
        self.running = False
        
        
        

#
#  PERSISTENCE
#

    def save_persistent_data(self):
        if self.DEBUG:
            print("Saving to persistence data store at path: " + str(self.persistence_file_path))
            
        try:
            if not os.path.isfile(self.persistence_file_path):
                open(self.persistence_file_path, 'a').close()
                if self.DEBUG:
                    print("Created an empty persistence file")
            else:
                if self.DEBUG:
                    print("Persistence file existed. Will try to save to it.")

            with open(self.persistence_file_path, 'w') as f:
                #if self.DEBUG:
                #    print("saving persistent data: " + str(self.persistent_data))
                #pretty = json.dumps(self.persistent_data, sort_keys=True, indent=4, separators=(',', ': '))
                json.dump( self.persistent_data, f, indent=4 )
                if self.DEBUG:
                    print("Data stored")
                return True

        except Exception as ex:
            print("Error: could not store data in persistent store: " + str(ex) )
            print(str(self.persistent_data))
            return False


    def update_network_info(self):
        try:
            possible_ip = get_own_ip()
            if valid_ip(possible_ip):
                self.ip_address = possible_ip
            #if self.DEBUG:
            #    print("My IP address = " + str(self.ip_address))
        except Exception as ex:
            print("Error getting own ip: " + str(ex))

        # Get hostname
        try:
            self.hostname = str(socket.gethostname())
            if self.DEBUG:
                print("fresh hostname = " + str(self.hostname))
        except Exception as ex:
            print("Error getting hostname: " + str(ex) + ", setting hostname to ip_address instead")
            self.hostname = str(self.ip_address)        
        

    def ethernet_check(self):
        check = shell('ifconfig eth0')
        if 'inet ' in check:
            return True
        else:
            return False


def shell(command):
    #print("SHELL COMMAND = " + str(command))
    shell_check = ""
    try:
        shell_check = subprocess.check_output(command, shell=True)
        shell_check = shell_check.decode("utf-8")
        shell_check = shell_check.strip()
    except:
        pass
    return shell_check 
        


def kill(command):
    check = ""
    try:
        search_command = "ps ax | grep \"" + command + "\" | grep -v grep"
        #print("in kill, search_command = " + str(search_command))
        check = shell(search_command)
        #print("check: " + str(check))

        if check != "":
            #print("Process was already running. Cleaning it up.")

            old_pid = check.split(" ")[0]
            #print("- old PID: " + str(old_pid))
            if old_pid != None:
                os.system("sudo kill " + old_pid)
                #print("- old process has been asked to stop")
                time.sleep(1)
        

            
    except Exception as ex:
        pass