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
from .util import run_command

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
                                          'prerelease_addons':self.adapter.prerelease_addons,
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
                                          'prerelease_addons':self.adapter.prerelease_addons,
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
                    


                elif action == 'install_pre_release':
                    state = False
                    message = ''
                    try:
                        
                        if 'addon_id' in request.body and 'current_version' in request.body and 'homepage_url' in request.body:
                            
                            homepage_url = str(request.body['homepage_url'])
                            addon_id = str(request.body['addon_id'])
                            current_version = str(request.body['current_version'])
                            
                            arch = 'linux-arm'
                            if self.adapter.bits == 64:
                                arch += '64'
                            
                            github_user = 'createcandle'
                            if '/createcandle/' in homepage_url:
                                pass
                            elif '/flatsiedatsie/' in homepage_url:
                                github_user = 'flatsiedatsie'
                            elif homepage_url.startswith('https://github.com/'):
                                homepage_url = homepage_url.replace('https://github.com/','')
                                if '/' in homepage_url:
                                    idx = homepage_url.find('/')
                                    if idx > 2:
                                        github_user = homepage_url[:idx]
                            else:
                                if self.DEBUG:
                                    print("install_pre_release: homepage_url was likely not a github URL")
                            
                            if addon_id == 'zigbee2mqtt-adapter':
                                github_user = 'kabbi'
                            
                            if self.DEBUG:
                                print("install_pre_release: Github user and addon_id are: ", github_user, addon_id)
                        
                            #get_raw_json_command = "jq -r 'map(select(.prerelease)) | first' <<< $(curl --silent https://api.github.com/repos/" + str(github_user) + "/" + str(addon_id) + "/releases)"
                            #get_raw_json_command = 'bash -c "' + get_raw_json_command + '"'
                            #if self.DEBUG:
                            #    print("install_pre_release: get_raw_json_command: \n\n" + str(get_raw_json_command) + "\n\n")
                            
                            pre_release_raw_json = run_command("curl --silent https://api.github.com/repos/" + str(github_user) + "/" + str(addon_id) + "/releases")
                            if isinstance(pre_release_raw_json,str):
                                if self.DEBUG:
                                    print("pre_release_raw_json: \n" + str(pre_release_raw_json))
                                try:
                                    if 'tag_name' in pre_release_raw_json:
                                        pre_release_json = json.loads(pre_release_raw_json)
                                        if len(pre_release_json):
                                            pre_release_json = pre_release_json[0]
                                            if self.DEBUG:
                                                print("first item: \n", json.dumps(pre_release_json,indent=4))
                                        
                                            if 'prerelease' in list(pre_release_json.keys()) and pre_release_json['prerelease'] == True:
                                        
                                                if 'tag_name' in pre_release_json and 'name' in pre_release_json and pre_release_json['tag_name'] != pre_release_json['name']:
                                                    message = 'Name and tag mismatch: ' + str(pre_release_json['name']) + " != " + pre_release_json['tag_name'] 
                                        
                                                if 'tag_name' in pre_release_json:
                                                    if pre_release_json['tag_name'] == current_version:
                                                        message = 'Already running the latest pre-release version of ' + str(addon_id)
                                                        self.prerelease_addons[addon_id] = current_version
                                                if message == '' and 'assets' in pre_release_json:
                                                    best_python_option = ''
                                                    best_node_option = ''
                                                    for asset_details in pre_release_json["assets"]:
                                                        if self.DEBUG:
                                                            print("install_pre_release: asset_details: ", asset_details)
                                                        if 'browser_download_url' in asset_details and 'name' in asset_details and arch in str(asset_details['name']) and not '.sha256sum' in str(asset_details['name']):
                                                            python_version_part = '-v' + str(self.adapter.python_version) + '.tgz'
                                                            if python_version_part in asset_details['name']:
                                                                best_python_option = str(asset_details['browser_download_url'])
                                                            elif '-v3.9.tgz' in asset_details['name'] and best_python_option == '':
                                                                best_python_option = str(asset_details['browser_download_url'])
                                                            elif not '-v3.' in asset_details['name']:
                                                                if 'v20' in asset_details['name'] or best_node_option == '':
                                                                    best_node_option = str(asset_details['browser_download_url'])
                                                    if best_python_option != '' and best_python_option.startswith('https://github.com/'):
                                                        state = self.adapter.install_addon_from_url(best_python_option,addon_id)
                                                        if state:
                                                            message = 'Addon updated to pre-release version ' + str(pre_release_json['tag_name'])
                                                    elif best_node_option != '' and best_node_option.startswith('https://github.com/'):
                                                        new_version = None
                                                        if 'tag_name' in pre_release_json:
                                                            new_version = str(pre_release_json['tag_name'])
                                                        state = self.adapter.install_addon_from_url(best_node_option,addon_id, new_version)
                                                        if state:
                                                            message = 'Addon updated to pre-release version ' + str(new_version)
                                                    else:
                                                        if self.DEBUG:
                                                            print("did not find a viable pre-release download url for " + str(addon_id))
                                            else:
                                                if self.DEBUG:
                                                    print("no tag_name spotted in pre_release_raw_json, aborting attempt to install pre-release")
                                                message = 'There is no pre-release for ' + str(addon_id)
                                                                
                                        else:
                                            if self.DEBUG:
                                                print("no tag_name spotted in pre_release_raw_json, aborting attempt to install pre-release")
                                            message = 'Zero releases spotted for ' + str(addon_id)
                                                
                                    else:
                                        if self.DEBUG:
                                            print("no tag_name spotted in pre_release_raw_json, aborting attempt to install pre-release")
                                        message = 'No pre-release available for ' + str(addon_id)
                                        
                                except Exception as ex:
                                    if self.DEBUG:
                                        print("install_pre_release: caught error loading pre-release json: ", ex)
                                    if message == '':
                                        message = 'Caught an error while checking if a pre-release is available for ' + str(addon_id)
                            else:
                                if self.DEBUG:
                                    print("install_pre_release: error, raw pre-release json was not a string")
                                message = 'downloaded pre_release_raw_json was not a string. Perhaps the addon is not on Github? Try it yourself: https://github.com/' + str(github_user) + "/" + str(addon_id)
                        else:
                            if self.DEBUG:
                                print("install_pre_release: invalid parameters provided")
                            message = 'Error, invalid parameters'
                                
                    except Exception as ex:
                        if self.DEBUG:
                            print("api caught error getting pre-release version of addon: " + str(ex))
                        if message == '':
                            message = 'Caught a general error while trying to install a pre-release addon version'
                        
                    return APIResponse(
                      status=200,
                      content_type='application/json',
                      content=json.dumps({'state':state,'message':message,'prerelease_addons':self.adapter.prerelease_addons}),
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


