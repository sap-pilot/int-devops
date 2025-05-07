@path: '/srv/cas'
service ContentAgentService @(requires: 'authenticated-user') {

    //  @(requires: 'operator')
    action export(payload: String) returns String;

    function resources(forceRefresh: Boolean) returns String;
}
