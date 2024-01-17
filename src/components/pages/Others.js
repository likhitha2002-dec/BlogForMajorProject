import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

const Others = () => {
  return (
    <div className="container mt-5">
      <h1 className="mb-4">1.Denial of Service (DOS) Attacks in Smart Contracts</h1>
      
      <p>
        Smart contracts on the blockchain are susceptible to various security threats, and one significant concern is the risk of Denial of Service (DOS) attacks. In this blog post, we'll explore the different aspects of DOS attacks on smart contracts and discuss some preventive techniques.
      </p>

      <h2 className="mt-4">The Vulnerability</h2>

      <p>
        DOS attacks in smart contracts can render them inoperable for a certain period or even permanently. A notorious example is the Second Parity MultiSig hack, where ether was trapped in contracts indefinitely. Let's delve into some nuanced Solidity coding patterns that may lead to DOS attacks.
      </p>

      <h3>1. External calls without gas stipends</h3>

      <p>
      It may be the case that you wish to make an external call to an unknown contract and continue processing the transaction regardless whether that call fails or not. Typically this is achieved by using the CALL opcode, which does not revert the transaction if the call fails (see Unchecked CALL Return Values for further details and examples). Let us consider a simple example, where we have a contract wallet, that slowly trickles out ether when the withdraw() function is called. A partner can add their address and spend gas to call the withdraw, giving both the partner and the owner 1% of the total contract balance.      </p>

      <pre>
        <code>
        {`contract TrickleWallet {

address public partner; // withdrawal partner - pay the gas, split the withdraw
address public constant owner = 0xA9E;
uint timeLastWithdrawn;
mapping(address => uint) withdrawPartnerBalances; // keep track of partners balances

function setWithdrawPartner(address _partner) public {
    require(partner == '0x0' || msg.sender == partner);
    partner = _partner;
}

// withdraw 1% to recipient and 1% to owner
function withdraw() public {
    uint amountToSend = address(this).balance/100;
    // perform a call without checking return
    // the recipient can revert, the owner will still get their share
    partner.call.value(amountToSend)();
    owner.transfer(amountToSend);
    // keep track of last withdrawal time
    timeLastWithdrawn = now;
    withdrawPartnerBalances[partner] += amountToSend;
}

// allow deposit of funds
function() payable {}

// convenience function
function contractBalance() view returns (uint) {
    return address(this).balance;
}
}
`}
</code>
      </pre>

      <p>Notice that on line [17] we perform an external call sending 1% of the contract balance to a user-specified account. The reason the CALL opcode is used, is to ensure that the owner still gets paid, even if the external call reverts. The issue is that the transaction will send all of its gas (in reality, only most of the transaction gas is sent, some is left to finish processing the call) to the external call. If the user were malicious they could create a contract that would consume all the gas, and force all transactions to withdraw() to fail, due to running out of gas.
For example, consider the following malicious contract that consumes all gas,
</p>
<pre>
  <code>
    {`
    contract ConsumeAllGas {
      function () payable {
          // an assert consumes all transaction gas, unlike a
          //revert which returns the remaining gas
          assert(1==2);
      }
  }
  
    `}
  </code>
</pre>

<p>If a withdrawal partner decided they didn't like the owner of the contract. They could set the partner address to this contract and lock all the funds in the TrickleWallet contract forever.
To prevent such DOS attack vectors, ensure a gas stipend is specified in an external call, to limit the amount of gas that that transaction can use. In our example, we could remedy this attack by changing line [17] to:
</p>
<pre>
  <code>
    {`partner.call.gas(50000).value(amountToSend)();`}
  </code>
</pre>
<p>This modification allows only 50,000 gas to be spent on the external transaction. The owner may set a gas price larger than this, in order to have their transaction complete, regardless of how much the external transaction uses.</p>

      <h3>2. Looping through externally manipulated mappings or arrays</h3>

      <p>
      In my adventures I've seen various forms of this kind of pattern. Typically it appears in scenarios where an owner wishes to distribute tokens amongst their investors, and do so with a distribute()-like function as can be seen in the example contract:
      </p>
      <pre>
        <code>
          {`contract DistributeTokens {
    address public owner; // gets set somewhere
    address[] investors; // array of investors
    uint[] investorTokens; // the amount of tokens each investor gets

    // ... extra functionality, including transfertoken()

    function invest() public payable {
        investors.push(msg.sender);
        investorTokens.push(msg.value * 5); // 5 times the wei sent
        }

    function distribute() public {
        require(msg.sender == owner); // only owner
        for(uint i = 0; i < investors.length; i++) {
            // here transferToken(to,amount) transfers "amount" of tokens to the address "to"
            transferToken(investors[i],investorTokens[i]);
        }
    }
}
`}
        </code>
      </pre>
      <p>Notice that the loop in this contract runs over an array which can be artificially inflated. An attacker can create many user accounts making the investor array large. In principle this can be done such that the gas required to execute the for loop exceeds the block gas limit, essentially making the distribute() function inoperable.</p>

      <h3>3. Owner operations</h3>

      <p>
      Another common pattern is where owners have specific privileges in contracts and must perform some task in order for the contract to proceed to the next state. One example would be an ICO contract that requires the owner to finalize() the contract which then allows tokens to be transferable, i.e.
      </p>
      <pre>
        <code>
          {`bool public isFinalized = false;
address public owner; // gets set somewhere

function finalize() public {
    require(msg.sender == owner);
    isFinalized == true;
}

// ... extra ICO functionality

// overloaded transfer function
function transfer(address _to, uint _value) returns (bool) {
    require(isFinalized);
    super.transfer(_to,_value)
}

`}
        </code>
      </pre>
      <p>In such cases, if a privileged user loses their private keys, or becomes inactive, the entire token contract becomes inoperable. In this case, if the owner cannot call finalize() no tokens can be transferred; i.e. the entire operation of the token ecosystem hinges on a single address.</p>

      <h3>4. Progressing state based on external calls</h3>

      <p>
      Contracts are sometimes written such that in order to progress to a new state requires sending ether to an address, or waiting for some input from an external source. These patterns can lead to DOS attacks, when the external call fails or is prevented for external reasons. In the example of sending ether, a user can create a contract which does not accept ether. If a contract requires ether to be withdrawn (consider a time-locking contract that requires all ether to be withdrawn before being useable again) in order to progress to a new state, the contract will never achieve the new state as ether can never be sent to the user's contract which does not accept ether.      </p>

      <h2 className="mt-4">Preventative Techniques</h2>

      <p>In the first example, contracts should not loop through data structures that can be artificially manipulated by external users. A withdrawal pattern is recommended, whereby each of the investors call a withdraw function to claim tokens independently.
In the second example a privileged user was required to change the state of the contract. In such examples (wherever possible) a fail-safe can be used in the event that the owner becomes incapacitated. One solution could be setting up the owner as a multisig contract. Another solution is to use a timelock, where the require on line [13] could include a time-based mechanism, such as require(msg.sender == owner || now unlockTime) which allows any user to finalise after a period of time, specified by unlockTime. This kind of mitigation technique can be used in the third example also. If external calls are required to progress to a new state, account for their possible failure and potentially add a time-based state progression in the event that the desired call never comes.
Note: Of course there are centralised alternatives to these suggestions where one can add a maintenanceUser who can come along and fix problems with DOS-based attack vectors if need be. Typically these kinds of contracts contain trust issues over the power of such an entity, but that is not a conversation for this section.

</p>


<h1 className="mb-4">2.Block Timestamp Manipulation</h1>
<h2>The Vulnerability</h2>
<p>block.timestamp or its alias now can be manipulated by miners if they have some incentive to do so. Let's construct a simple game, which would be vulnerable to miner exploitation,</p>
    

    <h1>roulette.sol:</h1>
    <pre>
      <code>
        {`
        contract Roulette {
          uint public pastBlockTime; // Forces one bet per block
      
          constructor() public payable {} // initially fund contract
      
          // fallback function used to make a bet
          function () public payable {
              require(msg.value == 10 ether); // must send 10 ether to play
              require(now != pastBlockTime); // only 1 transaction per block
              pastBlockTime = now;
              if(now % 15 == 0) { // winner
                  msg.sender.transfer(this.balance);
              }
          }
      }
      `}
      </code>
    </pre>
    <p>This contract behaves like a simple lottery. One transaction per block can bet 10 ether for a chance to win the balance of the contract. The assumption here is that, block.timestamp is uniformly distributed about the last two digits. If that were the case, there would be a 1/15 chance of winning this lottery.
However, as we know, miners can adjust the timestamp, should they need to. In this particular case, if enough ether pooled in the contract, a miner who solves a block is incentivised to choose a timestamp such that block.timestamp or now modulo 15 is 0. In doing so they may win the ether locked in this contract along with the block reward. As there is only one person allowed to bet per block, this is also vulnerable to front-running attacks.
In practice, block timestamps are monotonically increasing and so miners cannot choose arbitrary block timestamps (they must be larger than their predecessors). They are also limited to setting blocktimes not too far in the future as these blocks will likely be rejected by the network (nodes will not validate blocks whose timestamps are in the future).
</p>

<h1>Preventative Techniques</h1>
<p>Block timestamps should not be used for entropy or generating random numbers - i.e. they should not be the deciding factor (either directly or through some derivation) for winning a game or changing an important state (if assumed to be random).
Time-sensitive logic is sometimes required; i.e. unlocking contracts (timelocking), completing an ICO after a few weeks or enforcing expiry dates. It is sometimes recommend to use block.number (see the Solidity docs) and an average block time to estimate times; .i.e. 1 week with a 10 second block time, equates to approximately, 60480 blocks. Thus, specifying a block number at which to change a contract state can be more secure as miners are unable to manipulate the block number as easily. The BAT ICO contract employed this strategy.
This can be unnecessary if contracts aren't particularly concerned with miner manipulations of the block timestamp, but it is something to be aware of when developing contracts.
</p>

<h1 className="mb-4">3.	Unexpected Ether</h1>
<p>Typically when ether is sent to a contract, it must execute either the fallback function, or another function described in the contract. There are two exceptions to this, where ether can exist in a contract without having executed any code. Contracts which rely on code execution for every ether sent to the contract can be vulnerable to attacks where ether is forcibly sent to a contract.</p>

<h1>The Vulnerability</h1>
A common defensive programming technique that is useful in enforcing correct state transitions or validating operations is invariant-checking. This technique involves defining a set of invariants (metrics or parameters that should not change) and checking these invariants remain unchanged after a single (or many) operation(s). This is typically good design, provided the invariants being checked are in fact invariants. One example of an invariant is the totalSupply of a fixed issuance ERC20 token. As no functions should modify this invariant, one could add a check to the transfer() function that ensures the totalSupply remains unmodified to ensure the function is working as expected.
In particular, there is one apparent invariant, that may be tempting to use but can in fact be manipulated by external users (regardless of the rules put in place in the smart contract) .This is the current ether stored in the contract. Often when developers first learn Solidity they have the misconception that a contract can only accept or obtain ether via payable functions. This misconception can lead to contracts that have false assumptions about the ether balance within them which can lead to a range of vulnerabilities. The smoking gun for this vulnerability is the (incorrect) use of this.balance. As we will see, incorrect uses of this.balance can lead to serious vulnerabilities of this type.
There are two ways in which ether can (forcibly) be sent to a contract without using a payable function or executing any code on the contract. These are listed below.
<h1>Self Destruct</h1>
<p>Any contract is able to implement the selfdestruct(address) function, which removes all bytecode from the contract address and sends all ether stored there to the parameter-specified address. If this specified address is also a contract, no functions (including the fallback) get called. Therefore, the selfdestruct() function can be used to forcibly send ether to any contract regardless of any code that may exist in the contract. This is inclusive of contracts without any payable functions. This means, any attacker can create a contract with a selfdestruct() function, send ether to it, call selfdestruct(target) and force ether to be sent to a target contract. Martin Swende has an excellent blog post describing some quirks of the self-destruct opcode (Quirk #2) along with a description of how client nodes were checking incorrect invariants which could have lead to a rather catastrophic nuking of clients.</p>

<h1>Pre-sent Ether</h1>
<p>The second way a contract can obtain ether without using a selfdestruct() function or calling any payable functions is to pre-load the contract address with ether. Contract addresses are deterministic, in fact the address is calculated from the keccak256 (sometimes synonomous with SHA3) hash of the address creating the contract and the transaction nonce which creates the contract. Specifically, it is of the form: address = sha3(rlp.encode([account_address,transaction_nonce])) (see Keyless Ether for some fun use cases of this). This means, anyone can calculate what a contract address will be before it is created and thus send ether to that address. When the contract does get created it will have a non-zero ether balance.</p>
<h1>EtherGame.sol:</h1>
<pre>
  <code>
    {`
    contract EtherGame {

      uint public payoutMileStone1 = 3 ether;
      uint public mileStone1Reward = 2 ether;
      uint public payoutMileStone2 = 5 ether;
      uint public mileStone2Reward = 3 ether;
      uint public finalMileStone = 10 ether;
      uint public finalReward = 5 ether;
  
      mapping(address => uint) redeemableEther;
      // users pay 0.5 ether. At specific milestones, credit their accounts
      function play() public payable {
          require(msg.value == 0.5 ether); // each play is 0.5 ether
          uint currentBalance = this.balance + msg.value;
          // ensure no players after the game as finished
          require(currentBalance <= finalMileStone);
          // if at a milestone credit the players account
          if (currentBalance == payoutMileStone1) {
              redeemableEther[msg.sender] += mileStone1Reward;
          }
          else if (currentBalance == payoutMileStone2) {
              redeemableEther[msg.sender] += mileStone2Reward;
          }
          else if (currentBalance == finalMileStone ) {
              redeemableEther[msg.sender] += finalReward;
          }
          return;
      }
  
      function claimReward() public {
          // ensure the game is complete
          require(this.balance == finalMileStone);
          // ensure there is a reward to give
          require(redeemableEther[msg.sender] > 0);
          uint transferValue = redeemableEther[msg.sender];
          redeemableEther[msg.sender] = 0;
          msg.sender.transfer(transferValue);
      }
   }
  `}
  </code>
</pre>

<p>This contract represents a simple game (which would naturally invoke race-conditions) whereby players send 0.5 ether quanta to the contract in hope to be the player that reaches one of three milestones first. Milestone's are denominated in ether. The first to reach the milestone may claim a portion of the ether when the game has ended. The game ends when the final milestone (10 ether) is reached and users can claim their rewards.
The issues with the EtherGame contract come from the poor use of this.balance in both lines [14] (and by association [16]) and [32]. A mischievous attacker could forcibly send a small amount of ether, let's say 0.1 ether via the selfdestruct() function (discussed above) to prevent any future players from reaching a milestone. As all legitimate players can only send 0.5 ether increments, this.balance would no longer be half integer numbers, as it would also have the 0.1 ether contribution. This prevents all the if conditions on lines [18], [21] and [24] from being true.
Even worse, a vengeful attacker who missed a milestone, could forcibly send 10 ether (or an equivalent amount of ether that pushes the contract's balance above the finalMileStone) which would lock all rewards in the contract forever. This is because the claimReward() function will always revert, due to the require on line [32] (i.e. this.balance is greater than finalMileStone).
</p>

<h1>Preventative Techniques</h1>
<p>This vulnerability typically arises from the misuse of this.balance. Contract logic, when possible, should avoid being dependent on exact values of the balance of the contract because it can be artificially manipulated. If applying logic based on this.balance, ensure to account for unexpected balances.
If exact values of deposited ether are required, a self-defined variable should be used that gets incremented in payable functions, to safely track the deposited ether. This variable will not be influenced by the forced ether sent via a selfdestruct() call.

</p>
<p>With this in mind, a corrected version of the EtherGame contract could look like:</p>
<pre>
  <code>{`contract EtherGame {

uint public payoutMileStone1 = 3 ether;
uint public mileStone1Reward = 2 ether;
uint public payoutMileStone2 = 5 ether;
uint public mileStone2Reward = 3 ether;
uint public finalMileStone = 10 ether;
uint public finalReward = 5 ether;
uint public depositedWei;

mapping (address => uint) redeemableEther;

function play() public payable {
    require(msg.value == 0.5 ether);
    uint currentBalance = depositedWei + msg.value;
    // ensure no players after the game as finished
    require(currentBalance <= finalMileStone);
    if (currentBalance == payoutMileStone1) {
        redeemableEther[msg.sender] += mileStone1Reward;
    }
    else if (currentBalance == payoutMileStone2) {
        redeemableEther[msg.sender] += mileStone2Reward;
    }
    else if (currentBalance == finalMileStone ) {
        redeemableEther[msg.sender] += finalReward;
    }
    depositedWei += msg.value;
    return;
}

function claimReward() public {
    // ensure the game is complete
    require(depositedWei == finalMileStone);
    // ensure there is a reward to give
    require(redeemableEther[msg.sender] > 0);
    uint transferValue = redeemableEther[msg.sender];
    redeemableEther[msg.sender] = 0;
    msg.sender.transfer(transferValue);
}
}
`}
  </code>
</pre>
<p>Here, we have just created a new variable, depositedEther which keeps track of the known ether deposited, and it is this variable to which we perform our requirements and tests. Notice, that we no longer have any reference to this.balance.</p>


<h2 className='mb-4'>4. Delegatecall</h2>
<p>The CALL and DELEGATECALL opcodes are useful in allowing Ethereum developers to modularise their code. Standard external message calls to contracts are handled by the CALL opcode whereby code is run in the context of the external contract/function. The DELEGATECALL opcode is identical to the standard message call, except that the code executed at the targeted address is run in the context of the calling contract along with the fact that msg.sender and msg.value remain unchanged. This feature enables the implementation of libraries whereby developers can create reusable code for future contracts.
Although the differences between these two opcodes are simple and intuitive, the use of DELEGATECALL can lead to unexpected code execution
</p>
<h1>The Vulnerability</h1>
<p>The context preserving nature of DELEGATECALL has proved that building vulnerability-free custom libraries is not as easy as one might think. The code in libraries themselves can be secure and vulnerability-free however when run in the context of another application new vulnerabilities can arise. Let's see a fairly complex example of this, using Fibonacci numbers.
Consider the following library which can generate the Fibonacci sequence and sequences of similar form. FibonacciLib.sol1
</p>
<pre>
  <code>
    {`// library contract - calculates fibonacci-like numbers;
contract FibonacciLib {
    // initializing the standard fibonacci sequence;
    uint public start;
    uint public calculatedFibNumber;

    // modify the zeroth number in the sequence
    function setStart(uint _start) public {
        start = _start;
    }

    function setFibonacci(uint n) public {
        calculatedFibNumber = fibonacci(n);
    }

    function fibonacci(uint n) internal returns (uint) {
        if (n == 0) return start;
        else if (n == 1) return start + 1;
        else return fibonacci(n - 1) + fibonacci(n - 2);
    }
}
`}
  </code>
</pre>
<p>This library provides a function which can generate the n-th Fibonacci number in the sequence. It allows users to change the starting number of the sequence (start) and calculate the n-th Fibonacci-like numbers in this new sequence.</p>

<h1>FibonacciBalance.sol:</h1>
<pre>
  <code>
    {`contract FibonacciBalance {

address public fibonacciLibrary;
// the current fibonacci number to withdraw
uint public calculatedFibNumber;
// the starting fibonacci sequence number
uint public start = 3;
uint public withdrawalCounter;
// the fibonancci function selector
bytes4 constant fibSig = bytes4(sha3("setFibonacci(uint256)"));

// constructor - loads the contract with ether
constructor(address _fibonacciLibrary) public payable {
    fibonacciLibrary = _fibonacciLibrary;
}

function withdraw() {
    withdrawalCounter += 1;
    // calculate the fibonacci number for the current withdrawal user
    // this sets calculatedFibNumber
    require(fibonacciLibrary.delegatecall(fibSig, withdrawalCounter));
    msg.sender.transfer(calculatedFibNumber * 1 ether);
}

// allow users to call fibonacci library functions
function() public {
    require(fibonacciLibrary.delegatecall(msg.data));
}
}
`}
  </code>
</pre>


<pre>
  <code>
    {`contract Attack {
    uint storageSlot0; // corresponds to fibonacciLibrary
    uint storageSlot1; // corresponds to calculatedFibNumber

    // fallback - this will run if a specified function is not found
    function() public {
        storageSlot1 = 0; // we set calculatedFibNumber to 0, so that if withdraw
        // is called we don't send out any ether.
        <attacker_address>.transfer(this.balance); // we take all the ether
    }
 }
`}
  </code>
</pre>
<p>Notice that this attack contract modifies the calculatedFibNumber by changing storage slot[1]. In principle, an attacker could modify any other storage slots they choose to perform all kinds of attacks on this contract. I encourage all readers to put these contracts into Remix and experiment with different attack contracts and state changes through these delegatecall functions.
It is also important to notice that when we say that delegatecall is state-preserving, we are not talking about the variable names of the contract, rather the actual storage slots to which those names point. As you can see from this example, a simple mistake, can lead to an attacker hijacking the entire contract and its ether.
</p>

<h1>Preventative Techniques</h1>

<p>
Solidity provides the library keyword for implementing library contracts (see the Solidity Docs for further details). This ensures the library contract is stateless and non-self-destructable. Forcing libraries to be stateless mitigates the complexities of storage context demonstrated in this section. Stateless libraries also prevent attacks whereby attackers modify the state of the library directly in order to affect the contracts that depend on the library's code. As a general rule of thumb, when using DELEGATECALL pay careful attention to the possible calling context of both the library contract and the calling contract, and whenever possible, build state-less libraries.
</p>

    </div>


  );
};

export default Others;
