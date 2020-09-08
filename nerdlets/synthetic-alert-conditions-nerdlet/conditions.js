import React from 'react';
import PropTypes from "prop-types";
import * as Promise from "bluebird";
import ProgressBar from "./progressBar";
import { Icon,Card, CardHeader, CardBody,Toast,HeadingText,Spinner,Tooltip,NerdGraphQuery,AccountPicker,Link,UserQuery,Stack, StackItem,Grid, GridItem, TextField, Button, Table, TableHeader,TableHeaderCell,TableRowCell, TableRow } from 'nr1';
// https://docs.newrelic.com/docs/new-relic-programmable-platform-introduction

Promise.config({
    cancellation: true
})
export default class SyntheticAlertConditionsNerdlet extends React.Component {
    static propTypes = {
        nerdletState: PropTypes.object.isRequired
      };
    constructor(props) {
        super(props);
        this.state = {
            accountId: null,
            personalKey: null,
            adminKey: null,
            conditionsLoaded: false,
            apiKeyUrl: null,
            guid: null,
            monitorId: null,
            allConditions: [],
            finalConditions: [],
            filteredConditions: [],
            policyIds: [],
            completed: 0,
            loading: false,
            loadingConditions: false,
            showApi: false,
            nerdletGuid: null,
            noConditions: false,
            noId: false,
            region: "US",
            inLauncher: false,
            noPolicies: false
        }
        this.handleAdminKeyChange = this.handleAdminKeyChange.bind(this);
        this.getPolicies = this.getPolicies.bind(this);
        this.getSynthConditions = this.getSynthConditions.bind(this)
        this.getPromises = this.getPromises.bind(this)
        this.getMonitorId = this.getMonitorId.bind(this)
        this.filterConditions = this.filterConditions.bind(this)
        this.getNrqlName = this.getNrqlName.bind(this)
        this.getNrqlId = this.getNrqlId.bind(this)
        this.getNrqlFacetName = this.getNrqlFacetName.bind(this)
        this.getNrqlFacetId = this.getNrqlFacetId.bind(this)
        this.getConditionsTest = this.getConditionsTest.bind(this)
        
    }
    async getConditionsTest(adminKey, policy) {
        let _self = this,
            accountId = _self.state.accountId,
            region = _self.state.region == "EU" ? 'eu.' : '';
        
            
            // console.log("9. Getting Single")
            let conditionUrl = 'https://api.' + region + 'newrelic.com/v2/alerts_synthetics_conditions.json?policy_id=' + policy.id
            console.log("API URL", conditionUrl)
            let conditionResult = await fetch(conditionUrl, {
              method: 'GET',
              headers: {
                'X-Api-Key': adminKey,
                "Content-Type": "application/json"
              }
            })
            .then(response => {
                let apiResponse
                // console.log("Data",jsondata)
                // console.log("Daata",response)
                if (response.ok){
                    apiResponse =  200;
                } else if (response.status === 401) {
                    apiResponse = 401;
                } else if (response.status === 401){
                    apiResponse = 404;
                } else if (response.status === 500){
                    apiResponse = 500;
                }
                

                
                return apiResponse;
                
            });

            return conditionResult;
    }
    getSynthConditions(adminKey, policy) {
        let accountId = this.state.accountId
        let _self = this;
        return new Promise(function(resolve, reject) {
            // console.log("getConditions policy",policy.id)
            let region = _self.state.region == "EU" ? 'eu.' : '';
            console.log("Region test", region)
            let conditionUrl = 'https://api.' + region + 'newrelic.com/v2/alerts_synthetics_conditions.json?policy_id=' + policy.id
            fetch(conditionUrl, {
              method: 'GET',
              headers: {
                'X-Api-Key': adminKey,
                "Content-Type": "application/json"
              }
            })
            .then(response => {
                if(response.status===401){
                    
                    throw new Error("Invalid API Key")
                }
                return response.json()
            })
            .then(jsondata => {
                
                if (jsondata.synthetics_conditions.length > 0){
                    let allConditions = _self.state.allConditions
                    for (let condition of jsondata.synthetics_conditions){
                    
                        condition.policy = policy
                        condition.type = "Single"
                        condition.entities = []
                        condition.entities.push(condition.monitor_id)
                        let encoded = btoa(`{"nerdletId":"alerting-ui-classic.policies","nav":"Policies","selectedField":"thresholds","policyId":"` + condition.policy.id + `","conditionId":"` + condition.id + `"}`)
                        condition.permalink = 'https://one.newrelic.com/launcher/nrai.launcher?pane=' + encoded + '&sidebars[0]=eyJuZXJkbGV0SWQiOiJucmFpLm5hdmlnYXRpb24tYmFyIiwibmF2IjoiUG9saWNpZXMifQ&platform[accountId]=' + accountId
                    
                        allConditions.push(condition)
                        // console.log("Individual condition", condition)
                    
                    }

                    _self.setState({ allConditions, filteredConditions: allConditions })
                    
                }
                resolve()
                
            }).catch(error => {
                console.log(error)
                reject()
            });
          })
    }
    getMultiConditions(adminKey, policy) {
        let accountId = this.state.accountId
        let _self = this;
        return new Promise(function(resolve, reject) {
            // console.log("getConditions policy",policy.id)
            let region = _self.state.region == "EU" ? 'eu.' : '';
            let conditionUrl = 'https://api.' + region + 'newrelic.com/v2/alerts_location_failure_conditions/policies/' + policy.id + '.json'
            fetch(conditionUrl, {
              method: 'GET',
              headers: {
                'X-Api-Key': adminKey,
                "Content-Type": "application/json"
              }
            })
            .then(response => {
                console.log("Response", response.status)
                if(response.status===401){
                    throw new Error("Invalid API Key")                    
                }
                if(response.status===500){
                    throw new Error("Internal Server Error")                    
                }
                if(response.status===404){
                    _self.setState({ noConditions: true})
                    throw new Error("No Conditions Targetting this monitor")                    
                }
                return response.json()
            })
            .then(jsondata => {
                // console.log("Alll Condition", jsondata)
                if (jsondata.location_failure_conditions.length > 0){
                    let allConditions = _self.state.allConditions
                    for (let condition of jsondata.location_failure_conditions){
                    
                        condition.policy = policy
                        condition.type = "Multi"
                        let encoded = btoa(`{"nerdletId":"alerting-ui-classic.policies","nav":"Policies","selectedField":"thresholds","policyId":"` + condition.policy.id + `","conditionId":"` + condition.id + `"}`)
                        condition.permalink = 'https://one.newrelic.com/launcher/nrai.launcher?pane=' + encoded + '&sidebars[0]=eyJuZXJkbGV0SWQiOiJucmFpLm5hdmlnYXRpb24tYmFyIiwibmF2IjoiUG9saWNpZXMifQ&platform[accountId]=' + accountId
                    
                        allConditions.push(condition)
                        // console.log("Individual condition", condition)
                    
                    }
                    
                    _self.setState({ allConditions, filteredConditions: allConditions })
                }

                _self.setState({ completed: _self.state.completed + 1})
                resolve()
                
            }).catch(error => {
                console.log(error)
                reject()
            });
          })
    }

    async getPromises(adminKey, policies)  {
        

        let promises = [],
            _self = this;

        let firstPolicy = policies[0]
        console.log("Testing Admin Key")
        let keyTest = await _self.getConditionsTest(adminKey, firstPolicy)
        console.log("Test results", keyTest)
        if (keyTest == 401){
            console.log("Unauthorized")
            return 401
        } else if (keyTest == 200){
            console.log("")
            for(let policy of policies){
                promises.push(_self.getSynthConditions(adminKey, policy))
                promises.push(_self.getMultiConditions(adminKey, policy))
            }
            let allApiConditions = await Promise.all(promises).then(values => {
                console.log("All Promises complete", values)
    
                Toast.showToast({
                    title: 'Success',
                    description: 'Loaded ' + _self.state.allConditions.length + ' Conditions',
                    type: Toast.TYPE.NORMAL
                });
                return values
            }).catch(err => {
                console.log("Promises",err)
                _self.setState({ loading: false })
                Toast.showToast({
                    title: 'Error',
                    description: err,
                    type: Toast.TYPE.CRITICAL
                });
                promises.forEach(p => p.cancel());
            })
            console.log("After get Promises")
            return allApiConditions
        }
        
        
        
    }

    handleAdminKeyChange(adminKey) {

        if(adminKey.length > 0){
            
            // UserQuery.query().then(({ data }) => console.log("User",data));
            let _self = this,
                policies = _self.state.policyIds;
            _self.setState({ adminKey, loadingConditions: true, allConditions: [], filteredConditions: [] })

            async function conditionJobs(){
                console.log("Getting Promises")
                let apiConditions = await _self.getPromises(adminKey, policies)
                // console.log("API Test Response", apiConditions)
                if (apiConditions === 401){
                    return 401
                } else {
                    console.log("Getting NRQLs")
                    let nrqlConditions = await _self.getNrqls()
                    // console.log("Filtering", nrqlConditions)
                    let filteredConditions = await _self.filterConditions()
                    console.log("Filtered Chain", filteredConditions)
                    return 200
                }
                
            }

            conditionJobs().then((result)=>{
                if (result === 200){
                    _self.setState({loadingConditions: false, conditionsLoaded: true})
                } else if (result === 401){
                    Toast.showToast({
                        title: 'Error',
                        description: "API Key is Unauthorized, please check",
                        type: Toast.TYPE.CRITICAL
                    });
                    _self.setState({loadingConditions: false})
                }
                
            }).catch(err => {
                _self.setState({ loadingConditions: false })
                Toast.showToast({
                    title: 'Error',
                    description: err,
                    type: Toast.TYPE.CRITICAL
                });
            })
        } else {
            Toast.showToast({
                title: 'Error',
                description: 'Admin Key is Empty',
                type: Toast.TYPE.CRITICAL
            });
        }
        
        
        
        // UserQuery.query().then(({ data }) => console.log("User",data));

    }
    async getNrqlName(monitorName){
        // console.log("Getting NRQL Name")
        let _self = this
        let accountId = _self.state.accountId
        
        const gql = `
        {
            actor {
            account(id: ` + accountId + `) {
                alerts {
                
                nrqlConditionsSearch(searchCriteria: {queryLike: "'` + monitorName + `'"}) {
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
        }
        `;
        let nameQuery = await NerdGraphQuery.query({ query: gql }).then(res => {
            if(res.data.errors){
                throw new Error(res.data.errors)
            }
            const nrql = res.data.actor.account.alerts.nrqlConditionsSearch.nrqlConditions
            // console.log("NerdG NrqlName",nrql)
            if (nrql[0]){
                let filteredConditions = _self.state.filteredConditions
                for (let condition of nrql){
                
                    condition.type = "NRQL"
                    condition.entities = []
                    let encoded = btoa(`{"nerdletId":"alerting-ui-classic.policies","nav":"Policies","selectedField":"thresholds","policyId":"` + condition.policyId + `","conditionId":"` + condition.id + `"}`)
                    condition.permalink = 'https://one.newrelic.com/launcher/nrai.launcher?pane=' + encoded + '&sidebars[0]=eyJuZXJkbGV0SWQiOiJucmFpLm5hdmlnYXRpb24tYmFyIiwibmF2IjoiUG9saWNpZXMifQ&platform[accountId]=' + accountId
                    
                    filteredConditions.push(condition)
                    // console.log("Individual condition", condition)
                
                }
                _self.setState({ filteredConditions })
                return filteredConditions 

            } else {
                console.log("No NRQL Conditions targeting monitorName: " + monitorName)
                return null
            }
        })

        return nameQuery
    }
    async getNrqlId(monitorId, resolve, reject){
        // console.log("Getting NRQL Id")
        let _self = this

        let accountId = _self.state.accountId

        const gql = `
        {
            actor {
            account(id: ` + accountId + `) {
                alerts {
                
                nrqlConditionsSearch(searchCriteria: {queryLike: "'` + monitorId + `'"}) {
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
        }
        `;
        let idQuery = await NerdGraphQuery.query({ query: gql }).then(res => {
            if(res.data.errors){
                reject(res.data.errors)
            }
            const nrql = res.data.actor.account.alerts.nrqlConditionsSearch.nrqlConditions
            // console.log("NerdG NrqlId",nrql)
            if (nrql[0]){
                let filteredConditions = _self.state.filteredConditions
                for (let condition of nrql){
                
                    condition.type = "NRQL"
                    condition.entities = []
                    let encoded = btoa(`{"nerdletId":"alerting-ui-classic.policies","nav":"Policies","selectedField":"thresholds","policyId":"` + condition.policyId + `","conditionId":"` + condition.id + `"}`)
                    condition.permalink = 'https://one.newrelic.com/launcher/nrai.launcher?pane=' + encoded + '&sidebars[0]=eyJuZXJkbGV0SWQiOiJucmFpLm5hdmlnYXRpb24tYmFyIiwibmF2IjoiUG9saWNpZXMifQ&platform[accountId]=' + accountId
                    
                    filteredConditions.push(condition)
                    // console.log("Individual condition", condition)
                
                }
                _self.setState({ filteredConditions })
                return filteredConditions
            } else {
                console.log("No NRQL Conditions targeting monitorId: " + monitorId)
                return null
            }
            
        })
        return idQuery;
    }
    async getNrqlFacetName(){
        // console.log("Getting NRQL Facet")
        let _self = this
        let accountId = _self.state.accountId
        

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
        }
        `;
        let facetQuery = await NerdGraphQuery.query({ query: gql }).then(res => {
            if(res.data.errors){
                throw new Error(res.data.errors)
            }
            console.log("NerdG NrqlFacet",res.data.actor.account.alerts)
            const nrql = res.data.actor.account.alerts.nrqlConditionsSearch.nrqlConditions
            // console.log("NerdG NrqlFacet",res.data.actor.account.alerts)
            if (nrql[0]){
                let filteredConditions = _self.state.filteredConditions
                for (let condition of nrql){
                
                    condition.type = "NRQL Facet"
                    condition.facet = true
                    condition.entities = []
                    let encoded = btoa(`{"nerdletId":"alerting-ui-classic.policies","nav":"Policies","selectedField":"thresholds","policyId":"` + condition.policyId + `","conditionId":"` + condition.id + `"}`)
                    condition.permalink = 'https://one.newrelic.com/launcher/nrai.launcher?pane=' + encoded + '&sidebars[0]=eyJuZXJkbGV0SWQiOiJucmFpLm5hdmlnYXRpb24tYmFyIiwibmF2IjoiUG9saWNpZXMifQ&platform[accountId]=' + accountId
                    filteredConditions.push(condition)
                    // console.log("Individual condition", condition)
                    
                }

                _self.setState({ filteredConditions })
                return filteredConditions
            } else {
                console.log("No NRQL Conditions like `FACET monitorName`")
                return null
            }
        })

        return facetQuery
    }
    async getNrqlFacetId(){
        // console.log("Getting NRQL Facet")
        let _self = this
        let accountId = _self.state.accountId
        

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
        }
        `;
        let facetQuery = await NerdGraphQuery.query({ query: gql }).then(res => {
            if(res.data.errors){
                throw new Error(res.data.errors)
            }
            const nrql = res.data.actor.account.alerts.nrqlConditionsSearch.nrqlConditions
            // console.log("NerdG NrqlFacet",nrql)
            if (nrql[0]){
                let filteredConditions = _self.state.filteredConditions
                for (let condition of nrql){
                
                    condition.type = "NRQL Facet"
                    condition.entities = []
                    let encoded = btoa(`{"nerdletId":"alerting-ui-classic.policies","nav":"Policies","selectedField":"thresholds","policyId":"` + condition.policyId + `","conditionId":"` + condition.id + `"}`)
                    condition.permalink = 'https://one.newrelic.com/launcher/nrai.launcher?pane=' + encoded + '&sidebars[0]=eyJuZXJkbGV0SWQiOiJucmFpLm5hdmlnYXRpb24tYmFyIiwibmF2IjoiUG9saWNpZXMifQ&platform[accountId]=' + accountId
                    filteredConditions.push(condition)
                    // console.log("Individual condition", condition)
                    
                }

                _self.setState({ filteredConditions })
                return filteredConditions
            } else {
                console.log("No NRQL Conditions like `FACET monitorId`")
                return null
            }
        })

        return facetQuery
    }
    getNrqls(){
        let _self = this,
            monitorId = _self.state.monitorId,
            monitorName = _self.state.monitorName
        // console.log("Building NRQL Promises", monitorName, monitorId)
        async function nrqlWork(){
            // _self.setState({ loading: true})
            console.log("Getting Name Query")
            let nameQuery = await _self.getNrqlName(monitorName)
            console.log("Getting ID Query", nameQuery)
            let idQuery = await _self.getNrqlId(monitorId)
            console.log("Getting Facet Name Query")
            let facetNameQuery = await _self.getNrqlFacetName()
            console.log("Getting Facet Name Query")
            let facetIdQuery = await _self.getNrqlFacetId()
            return facetIdQuery
        }

        nrqlWork()
        .then((result) => {
            console.log("NRQLs Got", result)
        }).catch(err => {
            _self.setState({ loading: false })
            Toast.showToast({
                title: 'Error',
                description: err,
                type: Toast.TYPE.CRITICAL
            });
        });
    }
    async filterConditions( resolve, reject){
        let filteredConditions = this.state.allConditions,
            monitorId = this.state.monitorId
        // console.log("Filtered Conditions",filteredConditions)
        filteredConditions = await filteredConditions.filter(function(item){
            return item.entities.indexOf(monitorId) !== -1;
        });
        this.setState({ filteredConditions });
        return
    }
    async getPolicies(accountId){
        const gql = `
            {
                actor {
                    account(id: ` + accountId + `) {
                        alerts {
                            policiesSearch {
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
            }
        `;
        let policies = await NerdGraphQuery.query({ query: gql }).then(res => {
            if(res.data.errors){
                reject(res.data.errors)
            }
            const policyIds = res.data.actor.account.alerts.policiesSearch.policies
            console.log("NerdG Policies",typeof policyIds)
            if (policyIds){
                this.setState({policyIds})
                // console.log("Got Policies")

                Toast.showToast({
                    title: 'Success',
                    description: 'Loaded ' + policyIds.length + ' Policies',
                    type: Toast.TYPE.NORMAL
                });
            } else {
                Toast.showToast({
                    title: 'Error',
                    description: 'No Policies found, try refreshing the page',
                    type: Toast.TYPE.CRITICAL
                });
            }
            
            return policyIds
                
        })

        return policies
    
    
    }

    async getMonitorName(guid){
            // console.log("using guid", guid)
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
            let monitor = await NerdGraphQuery.query({ query: gql }).then(res => {
                console.log("Getting Name", res)
                if(res.data.errors){
                    throw new Error(res.data.errors)
                }
                const monitorObj = res.data.actor.entity
                console.log("NerdG MonitorName", monitorObj)
                if (monitorObj){
                    let apiKeyUrl = 'https://rpm.newrelic.com/accounts/' + monitorObj.account.id + '/integrations?page=api_keys'

                    this.setState({ accountId: monitorObj.account.id, apiKeyUrl })
                    console.log("Got MonitorName and Id", monitorObj.account.id )
                } else {
                    console.log("No Monitor Name Found")
                }
                
                return monitorObj
                    
            })
            return monitor
        
        
    }

    async getMonitorId(name, accountId){
        const _self = this;
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
        console.log("Query", gql)
        let monitorId = await NerdGraphQuery.query({ query: gql }).then(res => {
            // console.log("Has this monitor run in last 13 months?",res.data)
            if(res.data.errors){
                throw new Error(res.data.errors)
            }
            // UPDATES
            const license = res.data.actor.account.licenseKey,
                  region = license.slice(0, 2) == 'eu' ? 'EU' : "US";
            console.log("License Key Region", region)
            console.log("Results", JSON.stringify(res.errors))
            _self.setState({ region })
            //UPDATES
            const id = res.data.actor.account.nrql.results[0][`latest.monitorId`]
            console.log("NerdG MonitorId", id)
            if (id){
                this.setState({ id })
            } else {
                this.setState({noId: true})
            }
            return id 

        })

        return monitorId
    
}

    componentDidMount(){
        let _self = this;
        // console.log("Entity",_self.props.nerdletState.entityGuid)
        // UserQuery.query().then(({ data }) => console.log("User",data));
        let guid = _self.props.nerdletState.entityGuid

        console.log("GUID",guid)
        
        async function initialSetup(){
            _self.setState({ loading: true})
            console.log("Getting Name")
            let monitor = await _self.getMonitorName(guid)
            console.log("Getting Policies", monitor)
            let policies = await _self.getPolicies(monitor.account.id)
            console.log("Getting ID", policies)
            if (policies.length > 0){
                let monitorId = await _self.getMonitorId(monitor.name, monitor.account.id)
                if (monitorId.errors){
                    return monitorId
                } else {
                    monitor.id = monitorId
                    return monitor 
                }
                
            } else {
                return null
            
            }
            
        }
        
        
        
        if (guid){
            initialSetup()
            .then(result => {
                console.log("Built Monitor", result)
                if(result){
                    _self.setState({ monitorId: result.id, monitorName: result.name, showApi: true, loading: false})
                } else {
                    _self.setState({ noPolicies: true, loading: false })
                }
                
            }).catch(err => {
                _self.setState({ loading: false })
                Toast.showToast({
                    title: 'Error',
                    description: err,
                    type: Toast.TYPE.CRITICAL
                });
            });
        } else {
            _self.setState({ inLauncher: true })
        }
        
    }
    render() {
        return(
            <>
            {this.state.inLauncher ? <Card><CardBody>This is the Launcher for the Synthetics Condition Search Nerdlet. To use this, select a <Link to="https://one.newrelic.com/launcher/synthetics-nerdlets.home?nerdpacks=local&pane=eyJuZXJkbGV0SWQiOiJzeW50aGV0aWNzLW5lcmRsZXRzLm1vbml0b3ItbGlzdCJ9&platform[timeRange][duration]=1800000&platform[$isFallbackTimeRange]=true">Synthetic Monitor Entity</Link> and navigate to the application via the left-hand tab</CardBody></Card> : null}
    {this.state.noPolicies ? <Card><CardBody>There are no Alert Policies setup for this Account. To create one, go to <Link to={"https://one.newrelic.com/launcher/nrai.launcher?pane=eyJuZXJkbGV0SWQiOiJhbGVydGluZy11aS1jbGFzc2ljLnBvbGljaWVzIiwibmF2IjoiUG9saWNpZXMifQ==&sidebars[0]=eyJuZXJkbGV0SWQiOiJucmFpLm5hdmlnYXRpb24tYmFyIiwibmF2IjoiUG9saWNpZXMifQ==&platform[accountId]=" + this.state.accountId }>Alerts & AI</Link></CardBody></Card> : null}

            <Grid spacingType={[Grid.SPACING_TYPE.LARGE]}>
                {this.state.showApi && !this.state.noId ?  
                   <GridItem columnSpan={4}>
                        <TextField type={TextField.TYPE.PASSWORD} label="REST API Key" placeholder="Copy/Paste REST API..." onChange={(event) => this.handleAdminKeyChange(event.target.value)}/>
                        <Link to={this.state.apiKeyUrl}>Find your REST API Key</Link>
                        {this.state.conditionsLoaded ? <Card><CardBody><Icon type={Icon.TYPE.INTERFACE__INFO__INFO} /> 
                        These NRQL Conditions are general conditions that contain <code>FACET monitorName</code> or <code>FACET monitorId</code></CardBody></Card> : null}
                   </GridItem> : null}
           {this.state.noConditions ? <pre>No Conditions targetting this monitor</pre> : null}
           {this.state.noId ? <GridItem columnSpan={8}><pre>No Monitor ID found! If this monitor has run within the last 13 months try refreshing the page</pre></GridItem> : null}

           {this.state.conditionsLoaded && this.state.filteredConditions.length < 1 ? <GridItem columnSpan={8}><pre>This monitor {this.state.monitorName} has no Alert Conditions targeting it! Set them up now in Alerts & AI</pre></GridItem> : null}
           {this.state.conditionsLoaded && this.state.filteredConditions.length > 0 ?
               <GridItem columnSpan={8}>
                   <Table items={this.state.filteredConditions}>
                       <TableHeader>
                           <TableHeaderCell value={({ item }) => item}>
                               Condition 
                           </TableHeaderCell>
                           <TableHeaderCell value={({ item }) => item.entities.length}>
                               Entities
                           </TableHeaderCell>
                           <TableHeaderCell value={({ item }) => item.type}>
                               Type
                           </TableHeaderCell>
                           <TableHeaderCell value={({ item }) => item.enabled}>
                               Enabled
                           </TableHeaderCell>
                           
                       </TableHeader>
   
                       {({ item }) => (
                       <TableRow>
                           <TableRowCell>{item.type == "NRQL Facet" ? <Icon type={Icon.TYPE.INTERFACE__INFO__INFO} /> : null} <Link to={item.permalink}>{item.name} </Link></TableRowCell>
                           <TableRowCell><Tooltip text={item.entities.join('\n')} 
                                                  placementType={Tooltip.PLACEMENT_TYPE.BOTTOM}
                                         >{item.entities.length > 0 ? item.entities.length : "-"}</Tooltip></TableRowCell>
                           <TableRowCell>{item.type}</TableRowCell>
                           <TableRowCell>{item.enabled ? <Icon type={Icon.TYPE.INTERFACE__SIGN__CHECKMARK} /> : <Icon type={Icon.TYPE.INTERFACE__SIGN__TIMES} />}</TableRowCell>
                       </TableRow>
                       )}
                   </Table>
               </GridItem> : null}
            </Grid>
           {this.state.loading ? <><HeadingText type={HeadingText.TYPE.HEADING_1}>Loading</HeadingText><Spinner type={Spinner.TYPE.DOT} spacingType={[Spinner.SPACING_TYPE.EXTRA_LARGE]} inline/></> : null}
           {this.state.loadingConditions ? <><HeadingText type={HeadingText.TYPE.HEADING_1}>Loading Conditions</HeadingText>
           <Grid spacingType={[Grid.SPACING_TYPE.LARGE]}>
            <GridItem columnSpan={4}><ProgressBar bgcolor="#ef6c00" completed={Math.ceil((this.state.completed / this.state.policyIds.length) * 100)} /></GridItem>
            
           </Grid></> : null}


               </>
        )
    }
}
