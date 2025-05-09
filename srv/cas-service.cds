@path: '/srv/cas'
service ContentAgentService @(requires: 'authenticated-user') {


    /** get resource tree */
    function resources(forceRefresh: Boolean) returns String;

    /* @(requires: 'operator')
    * returns activity of this export operation
    * see https://api.sap.com/api/contentagentapi/resource/Activities
    * */
    action export(casDestination: String, targetTmsNodeId: Integer, countContentResources: Integer, payload: String) returns String;

    /*
    * query activity progress
    * see: https://api.sap.com/api/contentagentapi/resource/Activities
    * */
    function activity(casDestination: String, activityId: String) returns String;
}
