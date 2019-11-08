const express = require('express');
const data = require('./data');
const cron = require('node-cron');
const app = express();

let invoicesDB = data.invoices;
let fundsDB = data.funds;
let networkDB = data.network;
let currencyDB = data.currency;

const port = process.env.PORT || 5005;

let invoicesQueue = [];
let networkQueue = [];

// Monthly
cron.schedule('*/3 * * * *', () => {
  console.log('running monthly');
  monthly();
});

// Hourly
cron.schedule('*/1 * * * *', () => {
  console.log('running hourly');
  hourly();
});

// Pay all invoices of subscribers
const payAllInvoices = queue => {
  // Withdraw the invoice from queue
  let invoiceToPay = queue.shift();
  // Change its status to pending until the answer from payment comes
  invoicesDB.find(invoice => invoice.id === invoiceToPay.id).status = 'PENDING';
  // Send invoice to payment
  makePayment(invoiceToPay).then(result => {
    if (result === 'success') {
      // Payment was successful update status and time in invoices database
      invoicesDB.find(invoice => invoice.id === invoiceToPay.id).status =
        'PAID';
      invoicesDB.find(
        invoice => invoice.id === invoiceToPay.id
      ).time = Date.now();
    } else if (result === 'currency') {
      // Error occurred with currency send to currency errors db
      currencyDB.push(invoiceToPay);
    } else if (result === 'funds') {
      // Error occurred with funds send to funds errors db
      fundsDB.push(invoiceToPay);
    } else if (result === 'network') {
      // Error occurred with network send to network errors db
      networkDB.push(invoiceToPay);
    }
    // Send notification about payment result to customer and developers team
    notification(result);
    if (queue.length > 0) {
      payAllInvoices(queue);
    }
  });
};

// Pay all invoices that were held in the network error database
const payAllNetwork = queue => {
  // Withdraw the invoice from queue
  let invoiceToPay = queue.shift();
  // Send invoice to payment
  makePayment(invoiceToPay).then(result => {
    if (result === 'success') {
      // Payment was successful update status and time in invoices database
      invoicesDB.find(invoice => invoice.id === invoiceToPay.id).status =
        'PAID';
      invoicesDB.find(
        invoice => invoice.id === invoiceToPay.id
      ).time = Date.now();
    } else if (result === 'currency') {
      // Error occurred with currency send to currency errors db
      currencyDB.push(invoiceToPay);
    } else if (result === 'funds') {
      // Error occurred with funds send to funds errors db
      fundsDB.push(invoiceToPay);
    } else if (result === 'network') {
      // Error occurred with network send to network errors db
      networkDB.push(invoiceToPay);
    }
    // Remove the item from networkDB since it has been proceeded already
    networkDB.splice(
      networkDB.findIndex(invoice => invoice.id === invoiceToPay.id),
      1
    );
    // Send notification about payment result to customer and developers team
    notification(result);
    if (queue.length > 0) {
      payAllNetwork(queue);
    }
  });
};

const monthly = () => {
  // Make a queue of invoices to proceed with payment
  invoicesQueue = [...invoicesDB];
  if (invoicesQueue.length > 0) {
    // Send them all to be paid one by one
    payAllInvoices(invoicesQueue);
  }
};

const hourly = () => {
  // Make a queue of invoices to proceed with payment
  networkQueue = [...networkDB];
  if (networkQueue.length > 0) {
    // Send them all to be paid one by one
    payAllNetwork(networkQueue);
  }
};

const notification = note => {
  // Notify customer and developers team
  console.log(note);
};

// Make an actual payment of an invoice
async function makePayment(invoice) {
  console.log(invoice);
  let chance = Math.random();
  let a = 'currency';
  let b = 'network';
  let c = 'funds';
  let d = 'success';
  let answer;
  if (chance < 0.25) answer = a;
  else if (chance < 0.5) answer = b;
  else if (chance < 0.75) answer = c;
  else answer = d;
  return new Promise(resolve => {
    setTimeout(() => resolve(answer), 5000);
  });
}

// List all databases
app.get('/data', (req, res) => {
  res.json(data);
});

// Make a manual payment of an invoice that was held in currency error database
app.get('/currency/:id', (req, res) => {
  for (let i = 0; i < currencyDB.length; i++) {
    if (currencyDB[i].id === req.params.id) {
      invoicesDB.find(invoice => invoice.id === req.params.id).status = 'PAID';
      invoicesDB.find(
        invoice => invoice.id === req.params.id
      ).time = Date.now();
      currencyDB.splice(i, 1);
    }
  }
  res.json(data);
});

// Make a manual payment of an invoice that was held in funds error database
app.get('/funds/:id', (req, res) => {
  for (let i = 0; i < fundsDB.length; i++) {
    if (fundsDB[i].id === req.params.id) {
      invoicesDB.find(invoice => invoice.id === req.params.id).status = 'PAID';
      invoicesDB.find(
        invoice => invoice.id === req.params.id
      ).time = Date.now();
      fundsDB.splice(
        fundsDB.findIndex(invoice => invoice.id === req.params.id),
        1
      );
    }
  }
  res.json(data);
});

app.listen(port, () => console.log(`server running on port ${port}`));
