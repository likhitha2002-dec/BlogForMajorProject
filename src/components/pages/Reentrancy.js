import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

const Reentrancy = () => {
  return (
    <div className="container mt-5">
      <h1>Re-Entrancy in Ethereum Smart Contracts</h1>

      <p>
        One of the features of Ethereum smart contracts is the ability to call and utilize code of other external contracts.
        Contracts also typically handle ether, and as such often send ether to various external user addresses.
        The operation of calling external contracts, or sending ether to an address, requires the contract to submit an external call.
        These external calls can be hijacked by attackers whereby they force the contract to execute further code (i.e., through a fallback function),
        including calls back into itself. Thus, the code execution "re-enters" the contract.
        Attacks of this kind were used in the infamous DAO hack.
      </p>

      <h2>The Vulnerability</h2>

      <p>
        This attack can occur when a contract sends ether to an unknown address.
        An attacker can carefully construct a contract at an external address which contains malicious code in the fallback function.
        Thus, when a contract sends ether to this address, it will invoke the malicious code.
        Typically, the malicious code executes a function on the vulnerable contract, performing operations not expected by the developer.
        The name "re-entrancy" comes from the fact that the external malicious contract calls back a function on the vulnerable contract and "re-enters" code execution
        at an arbitrary location on the vulnerable contract.
      </p>

      <h2>Example: EtherStore.sol</h2>

      <pre>
        <code>
          {`
            pragma solidity ^0.4.8;

            contract EtherStore {
                uint256 public withdrawalLimit = 1 ether;
                mapping(address => uint256) public lastWithdrawTime;
                mapping(address => uint256) public balances;

                function depositFunds() public payable {
                    balances[msg.sender] += msg.value;
                }

                function withdrawFunds (uint256 _weiToWithdraw) public {
                    require(balances[msg.sender] >= _weiToWithdraw);
                    // limit the withdrawal
                    require(_weiToWithdraw <= withdrawalLimit);
                    // limit the time allowed to withdraw
                    require(now >= lastWithdrawTime[msg.sender] + 1 weeks);
                    require(msg.sender.call.value(_weiToWithdraw)());
                    balances[msg.sender] -= _weiToWithdraw;
                    lastWithdrawTime[msg.sender] = now;
                }
            }
          `}
        </code>
      </pre>

      <p>This contract has two public functions. depositFunds() and withdrawFunds(). The depositFunds() function simply increments the senders balances. The withdrawFunds() function allows the sender to specify the amount of wei to withdraw. It will only succeed if the requested amount to withdraw is less than 1 ether and a withdrawal hasn't occurred in the last week. Or does it?...
The vulnerability comes on line [17] where we send the user their requested amount of ether. Consider a malicious attacker creating the following contract,
</p>

      <h2>Example: Reentrancy Attack Contract (Attack.sol)</h2>

      <pre>
        <code>
          {`
            import "EtherStore.sol";

            contract Attack {
                EtherStore public etherStore;

                constructor(address _etherStoreAddress) {
                    etherStore = EtherStore(_etherStoreAddress);
                }

                function pwnEtherStore() public payable {
                    require(msg.value >= 1 ether);
                    etherStore.depositFunds.value(1 ether)();
                    etherStore.withdrawFunds(1 ether);
                }

                function collectEther() public {
                    msg.sender.transfer(this.balance);
                }

                // fallback function - where the magic happens
                function () payable {
                    if (etherStore.balance > 1 ether) {
                        etherStore.withdrawFunds(1 ether);
                    }
                }
            }
          `}
        </code>
      </pre>

      <h2>Reentrancy Attack Process</h2>

      <ol>
        <li>
          <p>
            <strong>Attack Contract Initialization:</strong> The attacker creates the malicious contract at a specific address (e.g., 0x0...123) with the EtherStore's contract address as the constructor parameter. This initializes and points the public variable etherStore to the targeted contract.
          </p>
        </li>
        <li>
          <p>
            <strong>Calling pwnEtherStore():</strong> The attacker calls the pwnEtherStore() function with some amount of ether (e.g., 1 ether). Assuming other users have deposited ether into the EtherStore contract, making its current balance 10 ether, the following steps occur:
          </p>
          <ol type="a">
            <li>Attack.sol - Line [15]: The depositFunds() function of the EtherStore contract is called with a msg.value of 1 ether. The sender (msg.sender) is the malicious contract (0x0...123), resulting in balances[0x0..123] = 1 ether.</li>
            <li>Attack.sol - Line [17]: The malicious contract then calls the withdrawFunds() function of the EtherStore contract with a parameter of 1 ether. This passes all the requirements (Lines [12]-[16] of the EtherStore contract) as no previous withdrawals have been made.</li>
            <li>EtherStore.sol - Line [17]: The contract sends 1 ether back to the malicious contract.</li>
            <li>Attack.sol - Line [25]: The ether sent to the malicious contract executes the fallback function.</li>
            <li>Attack.sol - Line [26]: The total balance of the EtherStore contract was 10 ether and is now 9 ether, so this if statement passes.</li>
            <li>Attack.sol - Line [27]: The fallback function calls the EtherStore withdrawFunds() function again, "re-entering" the EtherStore contract.</li>
            <li>EtherStore.sol - Line [11]: In this second call to withdrawFunds(), the balance is still 1 ether as line [18] has not yet been executed. Thus, balances[0x0..123] = 1 ether. This is also the case for the lastWithdrawTime variable, and all requirements pass.</li>
            <li>EtherStore.sol - Line [17]: Another 1 ether is withdrawn.</li>
            <li>Steps 4-8 will repeat until EtherStore.balance = 1, as dictated by line [26] in Attack.sol.</li>
            <li>Attack.sol - Line [26]: Once there is less than 1 ether left in the EtherStore contract, this if statement fails. This allows lines [18] and [19] of the EtherStore contract to be executed for each call to the withdrawFunds() function.</li>
            <li>EtherStore.sol - Lines [18] and [19]: The balances and lastWithdrawTime mappings are set, and the execution ends.</li>
          </ol>
        </li>
        <li>
          <p>
            <strong>Final Result:</strong> The attacker has withdrawn all (bar 1) ether from the EtherStore contract instantaneously with a single transaction.
          </p>
        </li>
      </ol>

     


      <h2>Preventative Techniques</h2>

      <p>There are a number of common techniques which help avoid potential re-entrancy vulnerabilities in smart contracts. The first is to ( whenever possible) use the built-in transfer() function when sending ether to external contracts. The transfer function only sends 2300 gas with the external call, which isn't enough for the destination address/contract to call another contract (i.e. re-enter the sending contract).
The second technique is to ensure that all logic that changes state variables happen before ether is sent out of the contract (or any external call). In the EtherStore example, lines [18] and [19] of EtherStore.sol should be put before line [17]. It is good practice to place any code that performs external calls to unknown addresses as the last operation in a localised function or piece of code execution. This is known as the checks-effects-interactions pattern.
A third technique is to introduce a mutex. That is, to add a state variable which locks the contract during code execution, preventing reentrancy calls.
Applying all of these techniques (all three are unnecessary, but is done for demonstrative purposes) to EtherStore.sol, gives the re-entrancy-free contract:
</p>
<pre>
        <code>
          {`
            contract EtherStore {
                // initialise the mutex
                bool reEntrancyMutex = false;
                uint256 public withdrawalLimit = 1 ether;
                mapping(address => uint256) public lastWithdrawTime;
                mapping(address => uint256) public balances;

                function depositFunds() public payable {
                    balances[msg.sender] += msg.value;
                }

                function withdrawFunds (uint256 _weiToWithdraw) public {
                    require(!reEntrancyMutex);
                    require(balances[msg.sender] >= _weiToWithdraw);
                    // limit the withdrawal
                    require(_weiToWithdraw <= withdrawalLimit);
                    // limit the time allowed to withdraw
                    require(now >= lastWithdrawTime[msg.sender] + 1 weeks);
                    balances[msg.sender] -= _weiToWithdraw;
                    lastWithdrawTime[msg.sender] = now;
                    // set the reEntrancy mutex before the external call
                    reEntrancyMutex = true;
                    msg.sender.transfer(_weiToWithdraw);
                    // release the mutex after the external call
                    reEntrancyMutex = false;
                }
            }
          `}
        </code>
      </pre>
      
    </div>
  );
};

export default Reentrancy;
