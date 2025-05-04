@path: '/srv/tms'
service TmsService @(requires: 'authenticated-user') {
    function landscape(forceRefresh: Boolean) returns String;
}