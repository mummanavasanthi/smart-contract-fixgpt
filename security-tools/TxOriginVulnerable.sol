// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TxOriginVulnerable {

    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function withdraw() public {
        require(
            tx.origin == owner,
            "Not owner"
        );

        payable(msg.sender).transfer(
            address(this).balance
        );
    }

    receive() external payable {}
}