@path: '/srv/cas'
service ContentAgentService @(requires: 'authenticated-user') {
    
    function resources(forceRefresh: Boolean) returns String;
}
