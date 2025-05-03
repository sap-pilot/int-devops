@path: '/srv/tms'
service TmsService @(requires: 'authenticated-user') {
    function landscape() returns String;
}