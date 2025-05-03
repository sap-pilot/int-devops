@path: '/srv/cas'
service ContentAgentService @(requires: 'authenticated-user') {

    /**
     * get current login user info
     */
    function resources(forceRefresh: Boolean) returns String;
}
