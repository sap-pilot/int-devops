@path: '/srv/cas'
service ContentAgentService @(requires: 'authenticated-user') {


    /** get resource tree */
    function resources(forceRefresh: Boolean) returns String;

    //  @(requires: 'operator')
    action export(casDestination: String, targetTmsNodeId: Integer, countContentResources: Integer, payload: String) returns String;
}
