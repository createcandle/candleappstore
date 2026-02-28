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
import requests # not used here?
#import threading
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
        print("Starting Candleappstore addon")
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
        
        # Exhibit mode
        self.exhibit_mode = False
        if os.path.isfile(self.boot_path + '/exhibit_mode.txt'):
            self.exhibit_mode = True
        
        
        self.busy_installing_addon_from_url = False
        self.prerelease_addons = {} # Keeps track of which addons were upgraded to a pre-release version during this session.
        # TODO: store this is persistent data, and then compare versions in the UI
        
        # Uninstall
        self.keep_data_on_uninstall = False

        self.addon_defaults = {} # addon defaults are not available via window.API, so have to scrape addon settings defaults manually from the manifest files
        self.addon_sizes = {} # holds how big the addon directories are
        self.installed_addons = [] # simple directory names list of installed addons (including broken ones)
        self.total_addons_size = None # will hold the total disk size of all the addons

        # Disk space
        self.user_partition_free_disk_space = None
        
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


        # Make sure the data directory exists
        try:
            if not os.path.isdir(self.data_dir_path):
                os.mkdir( self.data_dir_path )
                print("data directory did not exist, created it now")
        except Exception as ex:
            print("Error: could not make sure data dir exists: " + str(ex))

        # Cached files paths
        self.cached_get_apps_path = os.path.join(self.data_dir_path,'get_apps.json')
        if os.path.exists(self.cached_get_apps_path):
            os.system('rm ' + str(self.cached_get_apps_path)) # start without a cached version
        
        # determine the persistent data path
        self.persistence_file_path = os.path.join(self.data_dir_path, 'persistence.json')
        if self.DEBUG:
            print("self.persistence_file_path = " + str(self.persistence_file_path))
        
        
        
            
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
            print("Error loading persistent data: " + str(ex))
        

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
                self.save_persistent_data()
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
                
        except Exception as ex:
            if self.DEBUG:
                print("Error fixing missing values in persistent data: " + str(ex))
        
        
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
            for filename in raw_dirs:
                if os.path.isdir( os.path.join(self.user_profile['addonsDir'],filename) ):
                    real_dirs.append(filename)
                    
                    # get default addon settings from manifest file
                    try:
                        manifest_path = os.path.join(self.user_profile['addonsDir'],filename,'manifest.json')
                        #print("manifest_path: " + str(manifest_path))
                        if os.path.isfile(manifest_path):
                            #print('manifest file exists: ' + str(manifest_path))
                            
                            with open(manifest_path) as manifest_file:
                                parsed_json = json.load(manifest_file)
                                #print(parsed_json)
                                #print("\n\nLOADED JSON: " + str(parsed_json['options']['default']))
                                if self.DEBUG:
                                    print("loaded manifest: " + str(manifest_path))
                                defaults = {}
                                if 'options' in parsed_json:
                                    if 'default' in parsed_json['options']:
                                        new_default_settings[filename] = parsed_json['options']['default']
                                    else:
                                        if self.DEBUG:
                                            print("addon did not have default settings?")
                                
                        else:
                            if self.DEBUG:
                                print("Warning, addon dir did not have a manifest? missing file: " + str(filename))
                    except Exception as ex:
                        if self.DEBUG:
                            print("error getting default addon settings from: " + str(manifest_path))
                    
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
                                self.prerelease_addons[addon_id] = new_version
                                
                    return succes
            except Exception as ex:
                print("caught error in install_addon_from_url: ", ex)
                
        self.busy_installing_addon_from_url = False    
        return False
            
            
    def update_free_memory_and_disk_space(self):
        if self.DEBUG:
            print("in update_free_memory_and_disk_space")
        try:
            # Available disk space
            self.user_partition_free_disk_space = int(shell("df /home/pi/.webthings | awk 'NR==2{print $4}' | tr -d '\n'"))
            
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