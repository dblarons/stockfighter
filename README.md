### API

```javascript
constructor(creds, accountId)
getApiHealth()
getVenueHealth(venueId)
getStockList(venueId)
getOrderbook(venueId, stockId)
bid(venueId, stockId, price, qty, orderType)
ask(venueId, stockId, price, qty, orderType)
getQuote(venueId, stockId)
getOrderStatus(venueId, stockId, orderId)
deleteOrder(venueId, stockId, orderId)
getAllOrders(venueId)
getAllOrdersForStock(venueId, stockId)
```

### GM

```javascript
constructor(apiToken)
getInstanceStatus(instanceId)
resume(instanceId)
getIds(instanceId)
restart(instanceId)
```
