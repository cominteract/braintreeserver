const { Router } = require('express');
const { Transaction } = require('braintree');
const logger = require('debug');
const gateway = require('../lib/gateway');

const router = Router(); // eslint-disable-line new-cap
const debug = logger('braintree_example:router');
const TRANSACTION_SUCCESS_STATUSES = [
  Transaction.Status.Authorizing,
  Transaction.Status.Authorized,
  Transaction.Status.Settled,
  Transaction.Status.Settling,
  Transaction.Status.SettlementConfirmed,
  Transaction.Status.SettlementPending,
  Transaction.Status.SubmittedForSettlement,
];

function formatErrors(errors) {
  let formattedErrors = '';

  for (let [, { code, message }] of Object.entries(errors)) {
    formattedErrors += `Error: ${code}: ${message}
`;
  }

  return formattedErrors;
}

function createResultObject({ status }) {
  let result;

  if (TRANSACTION_SUCCESS_STATUSES.indexOf(status) !== -1) {
    result = {
      header: 'Sweet Success!',
      icon: 'success',
      message:
        'Your test transaction has been successfully processed. See the Braintree API response and try again.',
    };
  } else {
    result = {
      header: 'Transaction Failed',
      icon: 'fail',
      message: `Your test transaction has a status of ${status}. See the Braintree API response and try again.`,
    };
  }

  return result;
}

router.get('/', (req, res) => {
  res.redirect('/checkouts/new');
});

router.get('/client_token', (req, res) => {
  gateway.clientToken.generate({}).then(({ clientToken }) => {
    res.send(clientToken);
  });
});

router.get('/checkouts/new', (req, res) => {
  gateway.clientToken.generate({}).then(({ clientToken }) => {
    res.render('checkouts/new', {
      clientToken,
      messages: req.flash('error'),
    });
  });
});

router.get('/checkouts/:id', (req, res) => {
  let result;
  const transactionId = req.params.id;

  gateway.transaction.find(transactionId).then((transaction) => {
    result = createResultObject(transaction);
    res.render('checkouts/show', { transaction, result });
  });
});



router.post('/post_checkout_transact', function(req, res) {
  // Use the payment method nonce here
  var nonceFromTheClient = req.body.paymentMethodNonce;
  // Create customer details
  var customer = req.body.customer

  var deviceData = req.body.deviceData

  var shipping = req.body.shipping

  var billing = req.body.billing

  var newTransaction = gateway.transaction.sale({
    amount: req.body.amount,
    deviceData: deviceData,
    customer: customer,
    paymentMethodNonce: nonceFromTheClient,
    options: {
      // This option requests the funds from the transaction
      // once it has been authorized successfully
      submitForSettlement: true
    }
  }, function(error, result) {
      if (result) {
        res.send(result);
      } else {
        res.status(500).send(error);
      }
  });
});


router.post('/all_merchants', function(req, res) {
  gateway.merchantAccount.all((err, result) => {
      if (result) {
        res.send(result);
      } else {
        res.status(500).send(err);
      }
  });  
});

router.post('/create_merchant', function(req, res) {
  var merchantAccountParams = req.body  
  gateway.merchantAccount.create(merchantAccountParams, function (err, result) {
      if (result) {
        res.send(result);
      } else {
        res.status(500).send(err);
      }
  });
});

router.post('/all_customers', function(req, res) {
  gateway.customer.search((search) => {
      search.id().is("the_customer_id");
    }, (err, result) => {
        if (result) {
          res.send(result);
        } else {
          res.status(500).send(err);
        }
  });
});

router.post('/create_customer', function(req, res) {
  var customerParams = req.body  
  gateway.customer.create(customerParams, function (err, result) {
      if (result) {
        res.send(result);
      } else {
        res.status(500).send(err);
      }
  });
});


router.post('/post_checkout', function(req, res) {
  // Use the payment method nonce here
  var nonceFromTheClient = req.body.paymentMethodNonce;
  // Create a new transaction for $10
  var newTransaction = gateway.transaction.sale({
    amount: req.body.amount,
    paymentMethodNonce: nonceFromTheClient,
    options: {
      // This option requests the funds from the transaction
      // once it has been authorized successfully
      submitForSettlement: true
    }
  }, function(error, result) {
      if (result) {
        res.send(result);
      } else {
        res.status(500).send(error);
      }
  });
});


router.post('/checkouts', (req, res) => {
  // In production you should not take amounts directly from clients
  const { amount, payment_method_nonce: paymentMethodNonce } = req.body;

  gateway.transaction
    .sale({
      amount,
      paymentMethodNonce,
      options: { submitForSettlement: true },
    })
    .then((result) => {
      const { success, transaction } = result;

      return new Promise((resolve, reject) => {
        if (success || transaction) {
          res.redirect(`checkouts/${transaction.id}`);

          resolve();
        }

        reject(result);
      });
    })
    .catch(({ errors }) => {
      const deepErrors = errors.deepErrors();

      debug('errors from transaction.sale %O', deepErrors);

      req.flash('error', { msg: formatErrors(deepErrors) });
      res.redirect('checkouts/new');
    });
});

module.exports = router;
