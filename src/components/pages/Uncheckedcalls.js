import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

const UncheckedCalls = () => {
  return (
    <div className="container mt-5">
      <h1>Unchecked CALL Return Values in Ethereum Smart Contracts</h1>

      <p>
        There are several ways of performing external calls in Solidity. Sending ether to external accounts is commonly performed via the <code>transfer()</code> method. However, the <code>send()</code> function can also be used, and, for more versatile external calls, the CALL opcode can be directly employed in Solidity. The <code>call()</code> and <code>send()</code> functions return a boolean indicating if the call succeeded or failed. However, a common pitfall arises when the return value is not checked, and the developer expects a revert to occur.
      </p>

      <h2>What’s the "unchecked-send" bug?</h2>

      <p>
        To have a contract send Ether to some other address, the most straightforward way is to use the <code>send</code> keyword. This acts like a method that’s defined for every "address" object. For example, the following fragment of code might be found in a smart contract that implements a board game.
      </p>

      <pre>
        <code>
          {`
            if (gameHasEnded && !(prizePaidOut)) {
              winner.send(1000); // send a prize to the winner
              prizePaidOut = true;
            }
          `}
        </code>
      </pre>

      <p>
      The problem here is that the send method can fail. If it fails, then the winner does not get the money, yet prizePaidOut might be set to True.
There are actually two different cases where winner.send() can fail. We’ll care about the distinction between them later on in this post. The first case is if the winner address is a contract (rather than a user account), and the code for that contract throws an exception (e.g., if it uses too much gas). If this is the case, then perhaps the concern is moot since it’s the "winner's" own fault anyway. The second case is less obvious. The Ethereum Virtual Machine has a limited resource called the ‘callstack’, and this resource can be consumed by other contract code that was executed earlier in the transaction. If the callstack is already consumed by the time we reach the send instruction, then it will fail regardless of how the winner is defined. The winner’s prize would be destroyed through no fault of his own! A correctly engineered smart contract should protect the winner from this ‘callstack attack’.

      </p>


      <h2>How can this bug be avoided?</h2>

      <p>
        The Ethereum documentation contains a short remark warning about this potential hazard:
      </p>

      <p>The Ethereum documentation contains a short remark warning about this potential hazard [3]:
There are some dangers in using send: The transfer fails if the call stack depth is at 1024 (this can always be forced by the caller) and it also fails if the recipient runs out of gas. So in order to make safe Ether transfers, always check the return value of send or even better: Use a pattern where the recipient withdraws the money.
This contains two suggestions. The first is to check the return value of send to see if it completes successfully. If it doesn’t, then throw an exception so all the state is rolled back.
</p>

     <pre>
      <code>
        {`

/*** Listing 2 ***/
if (gameHasEnded && !( prizePaidOut ) ) {
  if (winner.send(1000))
    prizePaidOut = True;
  else throw;
}

        `}
      </code>
     </pre>
     <p>This is an adequate fix for the current example, but sometimes it isn't the correct solution. Suppose we modify our example so that when the game is over, both the winner and the loser get something back. The obvious application of the "official" solution would be the following:</p>
      <pre>
        <code>
          {`
            /*** Listing 3 ***/
            if (gameHasEnded && !( prizePaidOut ) ) {
              if (winner.send(1000) && loser.send(10))
                prizePaidOut = True;
              else throw;
            }
            
          `}
        </code>
      </pre>

      <p>However, this is a mistake, since it introduces an additional vulnerability. Whereas this code protects the winner from the callstack attack, it also makes the winner and loser vulnerable to each other. In this case, what we want is to prevent the callstack attack, but to continue executing if the send instructions fail for any other reason.
Therefore an even better best-practice (the one recommended in our “Programmer’s Guide to Ethereum and Serpent”, though it applies equally well to Solidity), is to directly check that the callstack resource is available. There is no built-in support for inspecting the callstack. Instead, we can define a macro, callStackIsEmpty(), which probes the callstack by making a test message that fails if and only if the callstack is empty.
</p>

<pre>
  <code>
    {`
        /*** Listing 4 ***/
        if (gameHasEnded && !( prizePaidOut ) ) {
          if (callStackIsEmpty()) throw;
          winner.send(1000)
          loser.send(10)
          prizePaidOut = True;
        }
        
      `}
  </code>
</pre>

<p>The "even better" recommendation from the Ethereum documentation, to "Use a pattern where the recipient withdraws the money", is a bit cryptic, but bears explanation. The suggestion is to refactor your code so that the effects of a failed send are isolated to affect only one party at a time. An example of this approach is below. However, this advice is also an anti-pattern. It passes on responsibility for checking the callstack to the recipients themselves, making it likely for them to fall into the same trap as well.</p>
    
    <pre>
      <code>
        {`
            /*** Listing 5 ***/
            if (gameHasEnded && !( prizePaidOut ) ) {
              accounts[winner] += 1000
              accounts[loser] += 10
              prizePaidOut = True;
            }
            ...
            function withdraw(amount) {
              if (accounts[msg.sender] >= amount) {
                 msg.sender.send(amount);
                 accounts[msg.sender] -= amount;
              }
            }
            
        `}
      </code>
    </pre>
    <h2>Many high-profile smart contracts are vulnerable</h2>

    <p>The "King of the Ether Throne" lottery game is the most well-known case of this bug [4] so far. This bug wasn't noticed until after a sum of 200 Ether (worth more than $2000 at today's price) failed to reach a rightful lottery winner. The relevant code in King of the Ether resembles that of Listing 2. Fortunately, in this case, the contract developer was able to use an unrelated function in the contract as a "manual override" to release the stuck funds. A less scrupulous administrator could have used the same function to steal the Ether!
Almost a year earlier (while Ethereum was in its “frontier” release), a popular lottery contract, EtherPot [9], also suffered from the same bug.
</p>

<p>An earlier version of BTCRelay also exhibited this bug [7]. Although the hazard was noticed in an earlier security audit, the wrong fix was applied at first [8].
Detecting the "unchecked-send" bug on the live blockchain
How prevalent are these bugs? Are the warnings being heeded? Are the best-practices being followed?
</p>
    <p>We answer these questions empirically, by analyzing the Ethereum blockchain data, as well as the repository of Solidity code found on etherscrape.com. To do this, we develop a simple program analysis tool that inspects a blockchain contract, and uses heuristics to check whether either of the best-practice defensive techniques are being used.</p>
    
    <p>Listing 2 shows off the first defensive technique, as recommended in the Ethereum docs, which is to check the return value of send and throw an exception. To detect the use of this technique, we use a coarse approximation: we simply look for whether the return value of send is ignored or not.</p>
    <p>Listing 4 illustrates the second defensive technique, the one recommended in the UMD guide, which is to directly check whether the callstack is full by sending a test message. To detect this technique, we again use a coarse-grained approximation: we simply check whether or not a message is being sent in addition to the send instruction.</p>
    <h2>How many contracts are vulnerable?</h2>
    <p>We start by trying out our heuristics on the Etherscrape repository of Solidity source code. As of March 20, 2016, the Etherscrape repo contained 361 Solidity contract programs, 56 of which contained a send instruction. Of these contract programs, we’d infer that the majority (at least 36 of 56) do not use either of the defensive programming techniques.
Even if a contract doesn’t use either of the defensive techniques, it might or might not exhibit an actual vulnerability. We manually inspected the Solidity contracts to confirm if the vulnerability is present. For our purposes, we consider a contract vulnerable if its state can change even if the send instruction fails (therefore we would consider the code in Listing 5 vulnerable). We confirmed that the vulnerability is present in the vast majority, 32 out of 36 of these contracts.
Similarly, our heuristics don't guarantee that a defensive programming technique is actually being applied correctly. Take for instance "WeiFund," a decentralized open source crowdfunding DApp. This contract has two functions, refund() and payout(), that fool our heuristic. An excerpt from refund is shown below.
</p>
<pre>
  <code>
    {`function refund(uint _campaignID, uint contributionID) public {
  ...
  receiver.send(donation.amountContributed);
  donation.refunded = true;
  ...
  if(c.config != address(0))
    WeiFundConfig(c.config).refund(_campaignID, donation.contributor, donation.amountContributed);
}
`}
    </code>
    </pre>    
    <p>In this code, a message is sent to the address WeiFundConfig(c.config) in order to invoke a remote refund method, but only under certain conditions. If c.config is a null value, then the contract is indeed vulnerable to the callstack attack. Upon inspection, *not one of the Solidity programs that passed our heuristic check actually applied the recommended best-practice of testing the callstack directly.*</p>
    <h2>Consider the following example:</h2>
    <pre>
      <code>
        {`
            contract Lotto {

              bool public payedOut = false;
              address public winner;
              uint public winAmount;
          
              // ... extra functionality here
          
              function sendToWinner() public {
                  require(!payedOut);
                  winner.send(winAmount);
                  payedOut = true;
              }
          
              function withdrawLeftOver() public {
                  require(payedOut);
                  msg.sender.send(this.balance);
              }
          }
          
        `}
      </code>
    </pre>

    <p>This contract represents a Lotto-like contract, where a winner receives winAmount of ether, which typically leaves a little left over for anyone to withdraw.
The bug exists on line [11] where a send() is used without checking the response. In this trivial example, a winner whose transaction fails (either by running out of gas or being a contract that intentionally throws in the fallback function) allows payedOut to be set to true (regardless of whether ether was sent or not). In this case, the public can withdraw the winner's winnings via the withdrawLeftOver() function.
</p>

<h2>Preventive Techniques</h2>
<p>Whenever possible, use the transfer() function rather than send() as transfer() will revert if the external transaction reverts. If send() is required, always ensure to check the return value.
An even more robust recommendation is to adopt a withdrawal pattern. In this solution, each user is burdened with calling an isolated function (i.e. a withdraw function) which handles the sending of ether out of the contract and therefore independently deals with the consequences of failed send transactions. The idea is to logically isolate the external send functionality from the rest of the code base and place the burden of potentially failed transaction to the end-user who is calling the withdraw function.
</p>
    </div>
  );
};

export default UncheckedCalls;


