// config variables
const config = {
    uploadPath: './upload',
    prettyResponse: process.env.PRETTY_RESPONSE != 'false',
    redactAuthHeader: !process.env.REDACT_AUTH_HEADER || process.env.REDACT_AUTH_HEADER != 'false',
    //tmsUrl: 'https://int-devops.free.beeceptor.com',
    tmsUrl: process.env.TMS_URL ? process.env.TMS_URL : 'https://transport-service-app-backend.ts.cfapps.us10.hana.ondemand.com'
}

module.exports = { config };