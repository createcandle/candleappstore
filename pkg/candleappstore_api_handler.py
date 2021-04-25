"""Candleappstore API handler."""

import os
import re
import json
import copy
import time
from time import sleep
#import socket
from signal import SIGHUP
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
        print("INSIDE API HANDLER INIT")
        
        self.adapter = adapter
        #self.addon_name = 'hootspot-handler'
        self.DEBUG = self.adapter.DEBUG

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
                print("- was POST request, ignoring")
                return APIResponse(status=404)
            
            if request.path == '/ajax':
                
                action = str(request.body['action'])    
                print("ajax action = " + str(action))
                
                
                if action == 'init':
                    print('ajax handling init')
                    print("self.adapter.persistent_data = " + str(self.adapter.persistent_data))
                    
                    installed_addons = self.adapter.scan_installed_addons()
                    
                    return APIResponse(
                      status=200,
                      content_type='application/json',
                      content=json.dumps({'state' : True, 'message' : 'initialisation complete', 'addons': self.adapter.persistent_data['addons'], 'app_store_url':self.adapter.app_store_url, 'installed': installed_addons }),
                    )
                    
                    
                elif action == 'latest':
                    print('ajax handling latest')
                    #print("self.persistent_data = " + str(self.persistent_data))
                    filtered_animals = {}
                    try:
                        filtered_animals = self.filter_animals()
                    except:
                        print("Error while filtering animals")
                    
                    print("self.adapter.seconds = " + str(self.adapter.seconds))
                    
                    return APIResponse(
                      status=200,
                      content_type='application/json',
                      content=json.dumps({'state' : True, 'message' : 'updated data deceived', 'animals': filtered_animals, 'master_blocklist': self.adapter.persistent_data['master_blocklist'], 'seconds':self.adapter.seconds }),
                    )
                    
                    
                elif action == 'abort':
                    print('ajax handling abort')
                    #print("self.persistent_data = " + str(self.persistent_data))
                    self.adapter.allow_launch = False
                    return APIResponse(
                      status=200,
                      content_type='application/json',
                      content=json.dumps({'state' : True, 'message' : 'launch has been aborted' }),
                    )
                    
                
                elif action == 'get_json':
                    print('ajax handling get_json')
                    
                    json_data = '{"error":"response code was not 200"}'
                    try:
                        if 'url' in request.body:
                            url = self.adapter.app_store_url + str(request.body['url'])
                        
                            if 'parameters' in request.body:
                                parameters = request.body['parameters']
                                print("parameters = " + str(parameters))
                                response = self.session.post(url, data = parameters)

                            else:
                                response = self.session.get(url)
                        
                            print("response = " + str(response))
                            print("response = " + str(response.text))
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
        
        # TODO DEBUG TEMPORARY
        return self.adapter.persistent_data['animals']
        #return new_animals
        
        
        

        
        