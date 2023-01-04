"""Candleappstore adapter for Candle Controller / WebThings Gateway."""

# A future release will no longer show privacy sensitive information via the debug option. 
# For now, during early development, it will be available. Please be considerate of others if you use this in a home situation.


from __future__ import print_function

import os
#from os import path
import sys
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
#try:
#    sys.path.append(os.path.join(os.sep,'home','pi','.webthings','addons','candleappstore','lib'))
#except:
#    print("couldn't add extra path")
import re
import json
import time
#import queue
#import signal
import socket
#import asyncio
#import logging
import requests # not used here?
#import threading
#import selectors
import subprocess
from subprocess import call, Popen
#from collections import namedtuple


try:
#    from .intentions import *
#    print("succesfully imported intentions.py file")
    pass
except Exception as ex:
    print("ERROR loading intentions.py: " + str(ex))
    
from gateway_addon import Database, Adapter
from .util import *
#from .candleappstore_device import *
#from .candleappstore_notifier import *

try:
    #from gateway_addon import APIHandler, APIResponse
    from .candleappstore_api_handler import *
    print("CandleappstoreAPIHandler imported")
    #pass
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
        #print("Adapter ID = " + self.get_id())

        #os.environ["LD_LIBRARY_PATH"] = os.path.join(self.user_profile['addonsDir'],self.addon_name,'snips')

        # Get initial audio_output options
        #self.audio_controls = get_audio_controls()
        #print("audio controls: " + str(self.audio_controls))

        self.developer = False
        self.running = True
        self.app_store_url = 'https://www.candlesmarthome.com/appstore/'
        
        # Exhibit mode
        self.exhibit_mode = False
        if os.path.isfile('/boot/exhibit_mode.txt'):
            self.exhibit_mode = True
        
        # Uninstall
        self.keep_data_on_uninstall = False
        self.disable_uninstall = False
        if os.path.isfile('/boot/disable_uninstall.txt'):
            self.disable_uninstall = True
        
        
        
        #print("os.uname() = " + str(os.uname()))

        # Some paths
        #print("self.user_profile:")
        #print(str(self.user_profile))
        
        self.addon_path = os.path.join(self.user_profile['addonsDir'], self.addon_name)
        self.data_dir_path = os.path.join(self.user_profile['dataDir'], self.addon_name)


        # Make sure the data directory exists
        try:
            if not os.path.isdir(self.data_dir_path):
                os.mkdir( self.data_dir_path )
                print("data directory did not exist, created it now")
        except Exception as ex:
            print("Error: could not make sure data dir exists: " + str(ex))
            

        # Cached files paths
        self.cached_get_apps_path = os.path.join(self.data_dir_path,'get_apps.json')


        
        # determine the persistent data path
        try:
            self.persistence_file_path = os.path.join(self.data_dir_path, 'persistence.json')
            if self.DEBUG:
                print("self.persistence_file_path = " + str(self.persistence_file_path))
        except:
            try:
                print("setting persistence file path failed, will try older method.")
                self.persistence_file_path = os.path.join(os.path.expanduser('~'), '.webthings', 'data', 'candleappstore','persistence.json')
            except:
                print("Double error making persistence file path")
                self.persistence_file_path = "/home/pi/.webthings/data/candleappstore/persistence.json"
        
        
        
        
        # Get persistent data
        self.persistent_data = {}
        first_run = False
        try:
            if os.path.exists(self.persistence_file_path):
                with open(self.persistence_file_path) as f:
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
        #self.hostname = get_own_hostname()
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
            if 'permissions' not in self.persistent_data:
                self.persistent_data['permissions'] = {}
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


        # create or remove developer.txt from /boot
        if self.developer:
            if self.DEBUG:
                print("creating developer.txt file")
            os.system('sudo touch /boot/developer.txt')
            os.system('sudo systemctl start rsyslog.service')
        else:
            if os.path.isfile('/boot/developer.txt'):
                if self.DEBUG:
                    print("removing developer.txt file")
                os.system('sudo rm /boot/developer.txt')



        # get data required to find optimal packages to install

        self.bits = 32
        try:
            bits_check = shell('getconf LONG_BIT')
            self.bits = int(bits_check)
            if self.DEBUG:
                print("System bits: " + str(self.bits))
        except Exception as ex:
            print("error getting bits of system: " + str(ex))

        
        self.python_version = '3.9'
        try:
            python_check = shell('python3 --version')
            python_check = python_check.replace("Python ", "")
            python_version_parts = python_check.split('.')
            if len(python_version_parts) == 3:
                self.python_version = str(python_version_parts[0]) + "." + str(python_version_parts[1])
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
            print("-Debugging was in config")
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


    def scan_installed_addons(self):
        real_dirs = []
        #if self.DEBUG:
        #    print("self.user_profile['addonsDir'] = " + str(self.user_profile['addonsDir']))
        try:
            raw_dirs = os.listdir( self.user_profile['addonsDir'] )
            for filename in raw_dirs:
                if os.path.isdir( os.path.join(self.user_profile['addonsDir'],filename) ):
                    real_dirs.append(filename)
        except Exception as ex:
            if self.DEBUG:
                print("could not get list of actually installed addons directories: " + str(ex))
            
        return real_dirs


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

            with open(self.persistence_file_path) as f:
                #if self.DEBUG:
                #    print("saving persistent data: " + str(self.persistent_data))
                #pretty = json.dumps(self.persistent_data, sort_keys=True, indent=4, separators=(',', ': '))
                json.dump( self.persistent_data, open( self.persistence_file_path, 'w+' ), indent=4 )
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
    print("SHELL COMMAND = " + str(command))
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
        print("in kill, search_command = " + str(search_command))
        check = shell(search_command)
        print("check: " + str(check))

        if check != "":
            print("Process was already running. Cleaning it up.")

            old_pid = check.split(" ")[0]
            print("- old PID: " + str(old_pid))
            if old_pid != None:
                os.system("sudo kill " + old_pid)
                print("- old process has been asked to stop")
                time.sleep(1)
        

            
    except Exception as ex:
        pass