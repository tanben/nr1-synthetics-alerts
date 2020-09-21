

import { NerdGraphQuery} from 'nr1';

import * as ParseLinkHeader from 'parse-link-header';

export const getMonitorName=  async  function(guid){

    const gql = `
    {
        actor {

        entity(guid: "` + guid + `") {
            ... on SyntheticMonitorEntity {
            guid
            name
            }
            account{
                id
            }
            entityType
            permalink
            reporting
            type
            domain
            name
        }
        }
    }
    `;
    let response  = await NerdGraphQuery.query({ query: gql })

    const {data, errors} = response;
    // console.log("Response=", response)
    if(typeof errors !== 'undefined'){
        console.error(`Error retrieving monitor names.`);
        console.error(errors.message);
        throw errors;
    }

    const monitorObj = data.actor.entity
    // console.log("NerdG MonitorName", monitorObj)
    if (!monitorObj || Object.keys(monitorObj).length ===0){
        console.warn("No Monitor Name Found")
        return null;
    }
    return monitorObj;
}

export const getPolicies = async function (accountId, cursor= null){
    const gql = {
        query:`query ($cursor: String, $accountId: Int!) {
            actor {
                account(id: $accountId) {
                    alerts {
                        policiesSearch(cursor: $cursor) {
                            nextCursor
                            policies {
                                id
                                name
                                incidentPreference
                            }
                            totalCount
                        }
                    }
                }
            }
        }`,
        variables:{
            cursor,
            accountId
        }

    };
    const response  = await NerdGraphQuery.query(gql )

    const {data, errors} = response;
    if(typeof errors !== 'undefined'){
        console.error(`Error retrieving monitor names.`);
        return {error:new Error(`accountId=${accountId} ${errors[0].message}`),  policies:[]};
    }

    let  {policies, nextCursor} = data.actor.account.alerts.policiesSearch;
    let error=null;

    if (typeof policies === 'undefined'){
        policies = [];
    }

    if (nextCursor != null && nextCursor.length > 0) {
        let ret = await getPolicies( accountId,  nextCursor) ;
        if (ret.error){
            error = ret.error ;
        }else{
            policies = policies.concat( ret.policies );
        }
    }

    return {policies, error} ;

}

export const getMonitorId = async function (name, accountId){
    const gql = `
    {
        actor {
        account(id: ` + accountId + `) {
            licenseKey
            nrql(query: "SELECT latest(monitorId) FROM SyntheticCheck WHERE monitorName = '` + name + `' SINCE 13 month ago") {
            results
            }
        }
        }
    }
    `;

    // console.log("Query", gql);

    let response = await NerdGraphQuery.query({ query: gql })

    const {data, errors} = response;
    // console.log("Response=", response)
    if(typeof errors !== 'undefined'){
        console.error(`Error retrieving monitor names.`);
        return {error:new Error(`accountId=${accountId} ${errors[0].message}`), monitorId:null, region:null};
    }

    const license = data.actor.account.licenseKey ;
    const region = license.toLowerCase().slice(0, 2) == 'eu' ? 'EU' : "US";
    const monitorId = data.actor.account.nrql.results[0][`latest.monitorId`];

    return {monitorId, region, error:null};

}

function errorResponseMap({url, status, statusText}){
    let errMsg = statusText || `Unknown error response status code=${status}`;

    if (!statusText || statusText && statusText.length ==0){
        switch(status){
            case 401:
                errMsg=  'Invalid API key';
                break;
            case 500:
                errMsg = "Internal Server Error";
                break;
            case 403:
                errMsg = "Your New Relic API access isn't enabled.";
                break;
            case 404:
                errMsg = "No Conditions Targetting this monitor";
                break;
            default:
                errMsg = `Unknown error response status code=${status}`;
                break;
        }
    }

    return new Error( `Message [${errMsg}] Url [${url}]`);
}

export const getMultiLocationConditions = async function ({apiKey, accountId, monitor,  policy,    page=1}) {

    const {region} = monitor;
    const regionStr = (region.toLowerCase() == 'eu')? 'eu.':'';
    const conditionUrl = `https://api.${regionStr}newrelic.com/v2/alerts_location_failure_conditions/policies/${policy.id}.json?page=${page}`;

    const response=  await fetch(conditionUrl, {
            method: 'GET',
            headers: {
                'X-Api-Key': apiKey,
                "Content-Type": "application/json"
            }
        });

    // console.log (`response=`, response.status);
    if (response.status >=400){
        return {error: errorResponseMap(response),  conditions:[]};
    }

    const jsondata= await response.json();
    let conditions = [];
    let error=null;

    if (jsondata.location_failure_conditions.length === 0){
        return {conditions:[], error:null};
    }


    for (let condition of jsondata.location_failure_conditions){
        if (!condition.monitor_id || condition.entities.includes(monitor.id) === false){
            continue;
        }
        condition.policy = policy;
        condition.type = "Multi";
        condition.permalink =  createPermLink(condition.id, condition.policy.id, accountId, regionStr);
        conditions.push(condition);
    }


    const linkHeader = ParseLinkHeader(response.headers.get("link"));
    if (typeof  linkHeader.next !== 'undefined'){
        const ret =  await getMultiLocationConditions({apiKey, accountId, monitor,  policy, page:linkHeader.next.page});
        if (ret.error){
            error = ret.error ;
        }else{
            conditions = conditions.concat( ret.conditions );
        }

    }
    return {conditions, error};
}

export const  getSynthConditions= async function  ({apiKey, accountId, monitor,  policy, page=1}) {
    const {region} = monitor;
    const regionStr = (region.toLowerCase() == 'eu')? 'eu.':'';
    const conditionUrl = `https://api.${regionStr}newrelic.com/v2/alerts_synthetics_conditions.json?page=${page}&policy_id=${policy.id}`;


    const response= await fetch(conditionUrl, {
            method: 'GET',
            headers: {
                'X-Api-Key': apiKey,
                "Content-Type": "application/json"
            }
        });

    // console.log (`response=`, response.status);
    if (response.status >=400){
        return {error: errorResponseMap(response),  conditions:[]};
    }

    let conditions = [];
    let error=null;

    const jsondata= await response.json();
    if (jsondata.synthetics_conditions.length === 0){
        return {conditions:[], error:null};
    }

    for (let condition of jsondata.synthetics_conditions){

        if (!condition.monitor_id || condition.monitor_id !== monitor.id){
            continue;
        }
        condition.policy = policy;
        condition.type = "Single";
        condition.entities = [condition.monitor_id ];
        condition.permalink = createPermLink(condition.id, condition.policy.id, accountId, regionStr);
        conditions.push(condition);
    }

    const linkHeader = ParseLinkHeader(response.headers.get("link"));
    if (typeof  linkHeader.next !== 'undefined'){
        const ret =  await getSynthConditions({apiKey, accountId, monitor,  policy, page:linkHeader.next.page});
        if (ret.error){
            error = ret.error ;
        }else{
            conditions = conditions.concat( ret.conditions );
        }
    }
    return {conditions, error};

}


export const   getNrqlNameConditions = async function(accountId, monitor) {
    const gql = `
    {
        actor {
        account(id: ` + accountId + `) {
            alerts {

            nrqlConditionsSearch(searchCriteria: {queryLike: "'` + monitor.id + `'"}) {
                nextCursor
                nrqlConditions {
                enabled
                id
                name
                nrql {
                    query
                }
                policyId
                }
            }

            }
        }
        }
    }`;
    const response  = await NerdGraphQuery.query({ query: gql })

    const {data, errors} = response;
    // console.log("Response=", response)
    if(typeof errors !== 'undefined'){
        return Promise.reject( new Error (errors.message));
    }

    const {region} = monitor;
    const regionStr = (region.toLowerCase() == 'eu')? 'eu.':'';
    const nrql = data.actor.account.alerts.nrqlConditionsSearch.nrqlConditions

    const conditions = [];
    for (let condition of nrql){
        condition.type = "NRQL";
        condition.entities = [];
        condition.permalink =  createPermLink(condition.id, condition.policyId, accountId, regionStr);

        conditions.push(condition);

    }

    // console.log(`done getNrqlNameConditions conditions=${conditions.length}`);
    return [...conditions];
}


export const  getNrqlIdConditions = async function (accountId, monitor){
    const gql = `
    {
        actor {
        account(id: ` + accountId + `) {
            alerts {

            nrqlConditionsSearch(searchCriteria: {queryLike: "'` + monitor.id + `'"}) {
                nextCursor
                nrqlConditions {
                enabled
                id
                name
                nrql {
                    query
                }
                policyId
                }
            }

            }
        }
        }
    }`;
    const response  = await NerdGraphQuery.query({ query: gql })
    const {data, errors} = response;
    // console.log("Response=", response);
    if(typeof errors !== 'undefined'){
        return Promise.reject( new Error (errors.message));
    }

    const {region} = monitor;
    const regionStr = (region.toLowerCase() == 'eu')? 'eu.':'';
    const nrql = data.actor.account.alerts.nrqlConditionsSearch.nrqlConditions;
    const conditions = [];
    for (let condition of nrql){

        condition.type = "NRQL";
        condition.entities = [];
        condition.permalink = createPermLink(condition.id, condition.policyId, accountId, regionStr);
        conditions.push(condition);

    }
    // console.log(`done getNrqlIdConditions conditions=${conditions.length}`);
    return [...conditions];
}


export const getNrqlFacetNameConditions = async function(accountId, monitor) {
    const gql = `
    {
        actor {
        account(id: ` + accountId + `) {
            alerts {

            nrqlConditionsSearch(searchCriteria: {queryLike: "FACET monitorName"}) {
                nextCursor
                nrqlConditions {
                enabled
                id
                name
                nrql {
                    query
                }
                policyId
                }
            }

            }
        }
        }
    }`;

    const response = await NerdGraphQuery.query({ query: gql })
    const {data, errors} = response;
    // console.log("Response=", response)
    if(typeof errors !== 'undefined'){
        return Promise.reject( new Error (errors.message));
    }

    const {region} = monitor;
    const regionStr = (region.toLowerCase() == 'eu')? 'eu.':'';
    const nrql = data.actor.account.alerts.nrqlConditionsSearch.nrqlConditions;
    const conditions = [];
    for (let condition of nrql){

        condition.type = "NRQL Facet";
        condition.facet = true;
        condition.entities = [];
        condition.permalink = createPermLink(condition.id, condition.policyId, accountId, regionStr);
        conditions.push(condition);

    }
    // console.log(`done getNrqlFacetNameConditions conditions=${conditions.length}`);
    return [...conditions];
}


export const getNrqlFacetIdConditions = async function (accountId, monitor){
    const gql = `
    {
        actor {
        account(id: ` + accountId + `) {
            alerts {

            nrqlConditionsSearch(searchCriteria: {queryLike: "FACET monitorId"}) {
                nextCursor
                nrqlConditions {
                enabled
                id
                name
                nrql {
                    query
                }
                policyId
                }
            }

            }
        }
        }
    }`;
    const response = await NerdGraphQuery.query({ query: gql })
    const {data, errors} = response;
    // console.log("Response=", response)
    if(typeof errors !== 'undefined'){
        return Promise.reject( new Error (errors.message));
    }

    const {region} = monitor;
    const regionStr = (region.toLowerCase() == 'eu')? 'eu.':'';
    const nrql = data.actor.account.alerts.nrqlConditionsSearch.nrqlConditions
    const conditions = [];
    for (let condition of nrql){
        condition.type = "NRQL Facet";
        condition.entities = [];
        condition.permalink =  createPermLink(condition.id, condition.policyId, accountId, regionStr);
        conditions.push(condition);
    }

    // console.log(`done getNrqlFacetIdConditions conditions=${conditions.length}`);
    return [...conditions];
}




export const  validateApiKey= async function  (apiKey) {
    let labelsUrl = `https://api.newrelic.com/v2/labels.json`;

    const response = await fetch(labelsUrl, {
                                                method: 'GET',
                                                headers: {
                                                    'X-Api-Key': apiKey,
                                                    "Content-Type": "application/json"
                                                }
                                                });
    // console.log (`response=`, response.status);
    if (response.status >=400){
        return Promise.reject ( {message: errorResponseMap(response.status), apiKey});
    }
    return Promise.resolve(apiKey);
}


function createPermLink( conditionId, policyId, accountId, regionStr ){

    const paneObj={
        nerdletId: "alerting-ui-classic.policies",
        nav: "Policies",
        selectedField: "thresholds",
        policyId:`${policyId}`,
        conditionId:`${conditionId}`
    };
    const sidebarObj={
        nerdletId:"nrai.navigation-bar",
        nav:"Policies"
    };

    const sideBarEncoded= btoa(JSON.stringify(sidebarObj));
    let panelEncoded = btoa(JSON.stringify(paneObj));
    return `https://one.${regionStr}newrelic.com/launcher/nrai.launcher?pane=${panelEncoded}&sidebars[0]=${sideBarEncoded}&platform[accountId]=${accountId}`;
}