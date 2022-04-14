"""Candleappstore API handler."""

import os
import re
import json
#import copy
import time
from time import sleep
#import socket
#from signal import SIGHUP
import requests
#import subprocess
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
        if self.DEBUG:
            print("> > >  REQUEST < < <")
        try:
        
            if request.method != 'POST':
                #print("- was POST request, ignoring")
                return APIResponse(status=404)
            
            if request.path == '/ajax':
                
                action = str(request.body['action'])    
                 if self.DEBUG:
                     print("ajax action = " + str(action))
                
                
                if action == 'init':
                     if self.DEBUG:
                         print('ajax handling init')
                         print("self.adapter.persistent_data = " + str(self.adapter.persistent_data))
                    
                    installed_addons = self.adapter.scan_installed_addons()
                    
                    return APIResponse(
                      status=200,
                      content_type='application/json',
                      content=json.dumps({'state' : True, 'message' : 'initialisation complete', 'addons': self.adapter.persistent_data['addons'], 'app_store_url':self.adapter.app_store_url, 'installed':installed_addons, 'permissions':self.adapter.persistent_data['permissions'], 'developer':self.adapter.developer, 'disable_uninstall':self.adapter.disable_uninstall, 'debug':self.adapter.DEBUG}),
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
                        print("Error saving new permmission: " + str(ex))
                    
                    
                    return APIResponse(
                      status=200,
                      content_type='application/json',
                      content=json.dumps({'state' : state, 'message' : message, 'permissions': self.adapter.persistent_data['permissions'] }),
                    )
                    
                
                elif action == 'get_json':
                    #print('ajax handling get_json')
                    
                    json_data = '{"error":"response code was not 200"}'
                    try:
                        if 'url' in request.body:
                            url = self.adapter.app_store_url + str(request.body['url'])
                        
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
                                
                    except Exception as ex:
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
                    except Exception as ex:
                        print("Getting installed addon dirs error: " + str(ex))
                        
                    return APIResponse(
                      status=200,
                      content_type='application/json',
                      content=json.dumps({'state':True, 'installed':addon_dirs }),
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
                                    print("error: uninstall: addon data dir did not exist?")
                        else:
                            if self.DEBUG:
                                print("keeping data from addon that is being uninstalled")
                            
                    except Exception as ex:
                        print("Uninstall addon error: " + str(ex))
                        
                    addon_dirs = []
                    try:
                        addon_dirs = self.adapter.scan_installed_addons()
                    except Exception as ex:
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
                
        except Exception as e:
            print("Failed to handle UX extension API request: " + str(e))
            return APIResponse(
              status=500,
              content_type='application/json',
              content=json.dumps("API Error"),
            )



        
        except Exception as ex:
            print("Error while filtering out privacy sensitive data: " + str(ex))
            return {"error":"Error while doing privacy filtering"}
        
        
        
        

        
        