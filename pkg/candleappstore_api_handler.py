"""Candleappstore API handler."""

import os
import re
import sys
import json
#import copy
import time
from time import sleep
#import socket
#from signal import SIGHUP
import requests
import subprocess
#import threading

#from .util import valid_ip, arpa_detect_gateways

#from datetime import datetime,timedelta
#from dateutil import tz
#from dateutil.parser import *

try:
    from gateway_addon import APIHandler, APIResponse
    #print("succesfully loaded APIHandler and APIResponse from gateway_addon")
except:
    print("Import APIHandler and APIResponse from gateway_addon failed. Use at least WebThings Gateway version 0.10")
    sys.exit(1)



class CandleappstoreAPIHandler(APIHandler):
    """Candleappstore API handler."""

    def __init__(self, adapter, verbose=False):
        """Initialize the object."""
        
        
        self.adapter = adapter
        #self.addon_name = 'hootspot-handler'
        self.DEBUG = self.adapter.DEBUG
        
        if self.DEBUG:
            print("In candle App store addon api init")
        

        self.session = requests.Session()
        self.session.headers.update({'User-Agent': "candlecontroller1,0"})
            
        # Intiate extension addon API handler
        try:
            manifest_fname = os.path.join(
                os.path.dirname(__file__),
                '..',
                'manifest.json'
            )

            with open(manifest_fname, 'rt') as f:
                manifest = json.load(f)

            if self.DEBUG:
                print("manifest id in candleappstore handler: " + str(manifest['id']))
            APIHandler.__init__(self, manifest['id'])
            self.manager_proxy.add_api_handler(self)
            

            if self.DEBUG:
                print("self.manager_proxy = " + str(self.manager_proxy))
                print("Created new API HANDLER: " + str(manifest['id']))
        
        except Exception as e:
            print("Failed to init UX extension API handler: " + str(e))

        
        

#
#  HANDLE REQUEST
#

    def handle_request(self, request):
        """
        Handle a new API request for this handler.

        request -- APIRequest object
        """
        #if self.DEBUG:
        #    print("> > >  REQUEST < < <")
        try:
        
            if request.method != 'POST':
                #print("- was POST request, ignoring")
                return APIResponse(status=404)
            
            if request.path == '/ajax':
                
                action = str(request.body['action'])    
                #if self.DEBUG:
                #     print("ajax action = " + str(action))
                
                
                if action == 'init':
                    #if self.DEBUG:
                    #    print('ajax handling init')
                    #    print("self.adapter.persistent_data = " + str(self.adapter.persistent_data))
                    
                    installed_addons = []
                    try:
                        self.adapter.installed_addons = self.adapter.scan_installed_addons()
                    except Exception as ex:
                        if self.DEBUG:
                            print("Error getting installed addons list: " + str(ex))
                        
                    return APIResponse(
                      status=200,
                      content_type='application/json',
                      content=json.dumps({'state' : True, 
                                          'message' : 'initialisation complete', 
                                          #'addons': self.adapter.persistent_data['addons'], # doesn't seem used by anything
                                          'meta_updated_time': self.adapter.persistent_data['meta_updated_time'], 
                                          'app_store_url':self.adapter.app_store_url, 
                                          'permissions':self.adapter.persistent_data['permissions'], # doesn't seem used anymore
                                          'developer':self.adapter.developer, 
                                          'exhibit_mode':self.adapter.exhibit_mode, 
                                          'bits':self.adapter.bits,
                                          'python_version':self.adapter.python_version,
                                          'python_minor_version':self.adapter.python_minor_version,
                                          'node_version':self.adapter.node_version,
                                          'installed':self.adapter.installed_addons, 
                                          'addon_defaults':self.adapter.addon_defaults,
                                          'addon_sizes':self.adapter.addon_sizes, 
                                          'total_addons_size':self.adapter.total_addons_size,
                                          'free_disk_space':self.adapter.user_partition_free_disk_space,
                                          'total_memory':self.adapter.total_memory,
                                          'free_memory':self.adapter.free_memory,
                                          'available_memory':self.adapter.available_memory,
                                          'debug':self.adapter.DEBUG
                                      }),
                    )
                    
                    
                elif action == 'remember_permission':
                    if self.DEBUG:
                        print('ajax handling permission change')
                        #print("self.persistent_data = " + str(self.persistent_data))
                    
                    state = False
                    message = "Error saving permission"
                    try:
                        if 'addon_id' in request.body and 'permission' in request.body and 'value' in request.body:
                            addon_id = str(request.body['addon_id']) 
                            permission = str(request.body['permission'])
                            value = str(request.body['value']) 
                    
                            if not addon_id in self.adapter.persistent_data['permissions']:
                                self.adapter.persistent_data['permissions'][addon_id] = {}
                            
                            self.adapter.persistent_data['permissions'][addon_id][permission] = value
                            self.adapter.save_persistent_data()
                            state = True
                            message = "Permission preference has been saved"
                    except Exception as ex:
                        if self.DEBUG:
                            print("Error saving new permmission: " + str(ex))
                    
                    
                    return APIResponse(
                      status=200,
                      content_type='application/json',
                      content=json.dumps({'state' : state, 'message' : message, 'permissions': self.adapter.persistent_data['permissions'] }),
                    )
                    
                
                # Download something from the candle webserver
                elif action == 'get_json':
                    #print('ajax handling get_json')
                    
                    json_data = '{"error":"response code was not 200"}'
                    try:
                        if 'url' in request.body:
                            
                            filename = str(request.body['url'])
                            if self.DEBUG:
                                print("get_json: filename: " + str(filename))
                            url = self.adapter.app_store_url + filename
                            
                            meta = {'updated_time':0} # this will be replaced with the cloud version if the filename is get_apps.json
                            try:
                                if filename == 'get_apps.json':
                                    if self.DEBUG:
                                        print("user requested get_apps.json")
                                    # is there a cached version of get_apps.json available?
                                    if os.path.exists(self.adapter.cached_get_apps_path):
                                        
                                        # Quickly check if there is a new version of the addons overview available
                                        meta_response = self.session.get(self.adapter.app_store_url + 'meta.json')
                                        if self.DEBUG:
                                            print("meta.json response: " + str(meta_response.text))
                                        meta = json.loads(meta_response.text)
                            
                                        if meta['updated_time'] == self.adapter.persistent_data['meta_updated_time']:
                                            if self.DEBUG:
                                                print("Cached get_apps exists, and packages data in the cloud are still the same, so returning locally cached data instead")
                                            with open(self.adapter.cached_get_apps_path) as cached_file:
                                                json_data = cached_file.read()
                                                
                                                return APIResponse(
                                                  status=200,
                                                  content_type='application/json',
                                                  content=json.dumps({'state' : True, 'message' : 'locally cached get_apps.json', 'body':json_data }),
                                                )
                                        else:
                                            if self.DEBUG:
                                                print("meta.json timestamp was different from the timestamp in persistent data. Should download latest get_apps.json from candle website")
                                        
                            except Exception as ex:
                                if self.DEBUG:
                                    print("get_json: error checking meta_updated_time: " + str(ex))
                            
                        
                            if 'parameters' in request.body:
                                parameters = request.body['parameters']
                                if self.DEBUG:
                                    print("parameters = " + str(parameters))
                                response = self.session.post(url, data = parameters)

                            else:
                                response = self.session.get(url)
                        
                            #print("response = " + str(response))
                            #print("response = " + str(response.text))
                            if response.status_code == 200:
                                response.encoding = 'utf-8'
                                json_data = response.text #json.loads(response.text)
                                
                                # remember the time when the get_apps.json cache was refreshed, for future comparison with meta.json on candle server
                                if filename == 'get_apps.json':
                                    self.adapter.persistent_data['meta_updated_time'] = meta['updated_time']
                                    with open(self.adapter.cached_get_apps_path, 'w') as cache_file:
                                        cache_file.write(response.text)
                                
                    except Exception as ex:
                        if self.DEBUG:
                            print("error doing request: " + str(ex));
                            
                    #print("self.persistent_data = " + str(self.persistent_data))
                    
                    
                    
                    
                    return APIResponse(
                      status=200,
                      content_type='application/json',
                      content=json.dumps({'state' : True, 'message' : 'tried to get json', 'body':json_data }),
                    )
                    

                elif action == 'get_installed_dirs':
                    addon_dirs = []
                    try:
                        addon_dirs = self.adapter.scan_installed_addons()
                        self.adapter.scan_addons_file_size()
                        
                    except Exception as ex:
                        if self.DEBUG:
                            print("Getting installed addon dirs error: " + str(ex))
                        
                    return APIResponse(
                      status=200,
                      content_type='application/json',
                      content=json.dumps({'state':True, 
                                          'installed':addon_dirs, 
                                          'addon_defaults':self.adapter.addon_defaults, 
                                          'addon_sizes':self.adapter.addon_sizes, 
                                          'total_addons_size':self.adapter.total_addons_size,
                                          'free_disk_space':self.adapter.user_partition_free_disk_space,
                                          'free_memory':self.adapter.free_memory,
                                          'available_memory':self.adapter.available_memory,
                                          }),
                    )
                    
                    
                elif action == 'poll':
                    tail_lines = []
                    try:
                        if os.path.isfile('/home/pi/.webthings/log/run-app.log'):
                            tail_output = subprocess.check_output(['tail','-n100','/home/pi/.webthings/log/run-app.log']).decode(sys.stdout.encoding)
                            tail_lines = tail_output.splitlines()
                        else:
                            tail_lines = ["The internal log file doesn't exist (yet). The Privacy Manager addon might be set to automatically delete the internal logs as part of its privacy protection services."]
                    except Exception as ex:
                        if self.DEBUG:
                            print("Error getting log tail: " + str(ex))
                        tail_lines = ["error getting tail: " + str(ex)];
                        
                    return APIResponse(
                      status=200,
                      content_type='application/json',
                      content=json.dumps({'state':True, 'tail':tail_lines }),
                    )
                    

                elif action == 'uninstall':
                    if self.DEBUG:
                        print("uninstall addon request")
                    state = False
                    try:
                        if self.adapter.keep_data_on_uninstall == False:
                            if 'addon_id' in request.body:
                                addon_id = str(request.body['addon_id'])
                                
                                data_dir_to_delete = os.path.join(self.adapter.user_profile['dataDir'], addon_id)
                                if self.DEBUG:
                                    print("uninstall data dir: " + str(data_dir_to_delete))
                                if os.path.isdir(data_dir_to_delete):
                                    os.system('sudo rm -rf ' + str(data_dir_to_delete))
                                    state = True
                                    if self.DEBUG:
                                        print("data dir deleted")
                                        
                                else:
                                    if self.DEBUG:
                                        print("error: uninstall addon: data dir did not exist?")
                                    
                                addon_dir_to_delete = os.path.join(self.adapter.user_profile['addonsDir'], addon_id)
                                if self.DEBUG:
                                    print("uninstall addon dir: " + str(addon_dir_to_delete))
                                if os.path.isdir(addon_dir_to_delete):
                                    os.system('sudo rm -rf ' + str(addon_dir_to_delete))
                                    state = True
                                    if self.DEBUG:
                                        print("addon dir deleted")
                                        
                                else:
                                    if self.DEBUG:
                                        print("uninstall addon: addon dir did not exist. This is normal.")
                                    
                                state = True
                                    
                        else:
                            if self.DEBUG:
                                print("keeping data from addon that is being uninstalled")
                            
                    except Exception as ex:
                        if self.DEBUG:
                            print("Uninstall addon error: " + str(ex))
                        
                    addon_dirs = []
                    try:
                        addon_dirs = self.adapter.scan_installed_addons()
                    except Exception as ex:
                        if self.DEBUG:
                            print("Getting installed addon dirs error: " + str(ex))
                        
                    return APIResponse(
                      status=200,
                      content_type='application/json',
                      content=json.dumps({'state' : state, 'message' : 'addon data should be deleted', 'installed':addon_dirs }),
                    )
 
                else:
                    return APIResponse(status=404)
                    
            else:
                return APIResponse(status=404)
                
        except Exception as ex:
            if self.DEBUG:
                print("Failed to handle UX extension API request: " + str(ex))
            return APIResponse(
              status=500,
              content_type='application/json',
              content=json.dumps("API Error"),
            )


